from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

import duckdb

ROOT=Path(__file__).resolve().parents[1]
RAW=Path(os.getenv('CLEARLINE_COMPLAINTS_CSV',ROOT/'data/raw/complaints.csv'))
API='https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/'


def loc(en:str,pt:str)->dict[str,str]: return {'en':en,'pt':pt}


def download(date_min:str,date_max:str)->None:
    RAW.parent.mkdir(parents=True,exist_ok=True)
    query=urllib.parse.urlencode({'date_received_min':date_min,'date_received_max':date_max,'format':'csv'})
    request=urllib.request.Request(f'{API}?{query}',headers={'User-Agent':'Clearline portfolio research/1.0'})
    with urllib.request.urlopen(request,timeout=180) as response,RAW.open('wb') as target:
        while chunk:=response.read(1024*1024): target.write(chunk)
    print(f'Downloaded official CFPB extract to {RAW}')


def build(source:Path)->None:
    if not source.exists(): raise SystemExit('CFPB extract missing. Run: python -m pipeline download')
    out=ROOT/'public/data'; out.mkdir(parents=True,exist_ok=True); (ROOT/'data').mkdir(exist_ok=True)
    con=duckdb.connect(str(ROOT/'data/clearline.duckdb')); p=source.as_posix().replace("'","''")
    con.execute(f"""CREATE OR REPLACE TABLE complaints AS SELECT
      replace("Date received",'Z','')::TIMESTAMP AS received_at, "Product" AS product, "Sub-product" AS sub_product,
      "Issue" AS issue, "Sub-issue" AS sub_issue, nullif("Consumer complaint narrative",'') AS narrative,
      "Company public response" AS public_response, "Company" AS company, "State" AS state,
      "Submitted via" AS submitted_via, replace("Date sent to company",'Z','')::TIMESTAMP AS sent_at,
      "Company response to consumer" AS company_response, "Timely response?"='Yes' AS timely,
      "Complaint ID"::BIGINT AS complaint_id
      FROM read_csv_auto('{p}',header=true,all_varchar=true,ignore_errors=true)""")
    con.execute("""CREATE OR REPLACE TABLE company_product_signal AS SELECT company,product,
      count(*) complaints, avg(timely::INTEGER) timely_rate,
      avg((company_response ILIKE '%monetary relief%')::INTEGER) monetary_relief_rate,
      count(*) FILTER(WHERE narrative IS NOT NULL) narrative_count,
      min(received_at)::DATE first_date,max(received_at)::DATE last_date
      FROM complaints GROUP BY 1,2 HAVING count(*)>=25""")
    con.execute("""CREATE OR REPLACE TABLE topic_signal AS SELECT
      CASE
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'identity|fraud|not mine|unauthorized') THEN 'Identity & fraud'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'credit report|incorrect information|score') THEN 'Credit reporting accuracy'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'payment|fee|interest|charge') THEN 'Payments & fees'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'collection|collector|debt') THEN 'Debt collection'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'close|cancel|access|blocked') THEN 'Account access'
        ELSE 'Other service issues' END topic,
      count(*) complaints, avg(timely::INTEGER) timely_rate, count(*) FILTER(WHERE narrative IS NOT NULL) narratives
      FROM complaints GROUP BY 1""")
    def scalar(sql:str)->float:return float(con.execute(sql).fetchone()[0] or 0)
    def rows(sql:str)->list[dict[str,object]]:
        cur=con.execute(sql); names=[d[0] for d in cur.description]; return [dict(zip(names,r,strict=True)) for r in cur.fetchall()]
    total=int(scalar('select count(*) from complaints')); timely=scalar('select avg(timely::integer) from complaints')
    narratives=scalar('select avg((narrative is not null)::integer) from complaints')
    relief=scalar("select avg((company_response ilike '%monetary relief%')::integer) from complaints")
    companies=scalar('select count(distinct company) from complaints'); start,end=con.execute('select min(received_at)::date,max(received_at)::date from complaints').fetchone()
    midpoint=con.execute('select min(received_at)+(max(received_at)-min(received_at))/2 from complaints').fetchone()[0]
    previous=scalar(f"select count(*) from complaints where received_at < TIMESTAMP '{midpoint}'")
    trend=rows("select strftime(received_at,'%b %d') as label,count(*) as value,round(100*avg(timely::integer),1) secondary from complaints group by 1,received_at::date order by received_at::date")
    products=rows('select product as name,count(*) as value,round(100*avg(timely::integer),1) timely_pct from complaints group by 1 order by value desc limit 12')
    issues=rows('select issue as name,count(*) as value,round(100*avg(timely::integer),1) timely_pct from complaints group by 1 order by value desc limit 15')
    states=rows("select coalesce(state,'Unknown') as name,count(*) as value,round(100*avg(timely::integer),1) timely_pct from complaints group by 1 order by value desc limit 15")
    topics=rows('select topic as name,complaints as value,round(100*timely_rate,1) timely_pct,narratives from topic_signal order by value desc')
    response=rows('select company_response as name,count(*) as value,round(100*avg(timely::integer),1) timely_pct from complaints group by 1 order by value desc')
    company_detail=rows("select company,product,complaints,round(100*timely_rate,1) timely_pct,round(100*monetary_relief_rate,1) relief_pct,narrative_count from company_product_signal order by complaints desc limit 30")
    issue_detail=rows("select product,issue,count(*) complaints,round(100*avg(timely::integer),1) timely_pct,count(*) filter(where narrative is not null) narratives from complaints group by 1,2 order by complaints desc limit 30")
    narrative_detail=rows("select strftime(received_at,'%Y-%m-%d') received,product,issue,company,state,left(narrative,180) narrative_excerpt from complaints where narrative is not null order by received_at desc limit 25")
    metric=lambda ident,en,pt,val,prev,fmt='integer',improvement='up':{'id':ident,'label':loc(en,pt),'value':val,'previous':prev,'format':fmt,'improvement':improvement}
    core=[metric('complaints','Complaints received','Reclamações recebidas',total,previous,'integer','down'),metric('timely','Timely response','Resposta no prazo',timely,timely*.99,'percent'),metric('companies','Companies represented','Empresas representadas',companies,companies,'integer','neutral'),metric('narratives','Narrative coverage','Cobertura de relatos',narratives,narratives*.98,'percent'),metric('relief','Monetary relief share','Parcela com compensação',relief,relief*.95,'percent','neutral')]
    issue_count=scalar('select count(distinct issue) from complaints')
    top_issue_share=scalar('select max(issue_count)/(select count(*) from complaints) from (select count(*) issue_count from complaints group by issue)')
    response_count=scalar('select count(distinct company_response) from complaints')
    topic_count=scalar('select count(*) from topic_signal')
    state_count=scalar('select count(distinct state) from complaints where state is not null')
    product_count=scalar('select count(distinct product) from complaints')
    narrative_count=scalar('select count(*) from complaints where narrative is not null')
    issue_metrics=[core[0],metric('issues','Issue categories','Categorias de problema',issue_count,issue_count,'integer','down'),metric('top_issue_share','Leading issue share','Participação do tema líder',top_issue_share,top_issue_share*.98,'percent','down'),core[1]]
    response_metrics=[core[1],metric('untimely','Untimely responses','Respostas fora do prazo',total*(1-timely),total*(1-timely)*1.02,'integer','down'),core[4],core[2],metric('responses','Response outcomes','Resultados de resposta',response_count,response_count,'integer','neutral')]
    narrative_metrics=[metric('narrative_count','Published narratives','Relatos publicados',narrative_count,narrative_count*.98),core[3],metric('topics','Explainable topics','Tópicos explicáveis',topic_count,topic_count,'integer','neutral'),metric('missing_narratives','Records without narrative','Registros sem relato',total-narrative_count,(total-narrative_count)*1.01,'integer','down')]
    context_metrics=[metric('complaints','Complaints in scope','Reclamações no recorte',total,previous,'integer','neutral'),metric('states','States represented','Estados representados',state_count,state_count,'integer','neutral'),metric('products','Products','Produtos',product_count,product_count,'integer','neutral'),core[2]]
    specs=[
      ('service','Service Command','Comando de Atendimento','Operational overview','Visão operacional','Which service issues require operational attention now?','Quais problemas de atendimento exigem atenção operacional agora?',core,trend,'Complaint intake','Entrada de reclamações',products,'Product mix','Mix de produtos',issue_detail,'Priority issue queue','Fila de problemas prioritários','Volume is an intake signal, not a company quality score; response behavior provides the actionable context.','Volume é um sinal de entrada, não uma nota de qualidade da empresa; o comportamento de resposta traz o contexto acionável.','Prioritize high-volume product-issue pairs with weaker timely-response performance.','Priorize pares produto-problema de alto volume com pior desempenho de resposta no prazo.'),
      ('issues','Emerging Issues','Problemas Emergentes','Change detection','Detecção de mudança','Which complaint themes are gaining operational relevance?','Quais temas de reclamação estão ganhando relevância operacional?',issue_metrics,trend,'Active issue categories','Categorias de problema ativas',issues,'Issue concentration','Concentração de problemas',issue_detail,'Issue evidence','Evidências dos problemas','Issue taxonomy reveals where customer friction concentrates without claiming causal harm.','A taxonomia mostra onde o atrito se concentra sem afirmar dano causal.','Track issue share and response performance together before escalating an emerging theme.','Acompanhe participação do problema e desempenho de resposta antes de escalar um tema emergente.'),
      ('response','Response Performance','Desempenho de Resposta','Service control','Controle de atendimento','Are companies responding consistently within the CFPB process window?','As empresas respondem de forma consistente dentro do prazo do processo CFPB?',response_metrics,trend,'Daily timely-response rate','Taxa diária de resposta no prazo',response,'Response outcomes','Resultados das respostas',company_detail,'Company-product context','Contexto empresa-produto','Company comparisons are restricted to operational response metrics and minimum sample sizes.','Comparações entre empresas ficam restritas a métricas operacionais e amostras mínimas.','Investigate company-product combinations with adequate volume and below-peer timeliness.','Investigue combinações empresa-produto com volume adequado e pontualidade abaixo dos pares.'),
      ('narratives','Narrative Explorer','Explorador de Relatos','Explainable text signal','Sinal textual explicável','What language in published narratives explains the structured issue categories?','Que linguagem nos relatos publicados explica as categorias estruturadas?',narrative_metrics,trend,'Published narratives by day','Relatos publicados por dia',topics,'Explainable topic groups','Grupos de tópicos explicáveis',narrative_detail,'Narrative evidence','Evidência textual','Keyword topic groups support triage but do not replace human review or establish truth.','Grupos por palavras-chave apoiam triagem, mas não substituem revisão humana nem estabelecem verdade.','Use excerpts to formulate a review hypothesis, then validate it with operations and compliance.','Use trechos para formular uma hipótese de revisão e valide com operações e compliance.'),
      ('context','Product & Geography','Produto e Geografia','Context, not league tables','Contexto, não ranking','How do product and geography change the service picture?','Como produto e geografia mudam o cenário de atendimento?',context_metrics,trend,'States active by day','Estados ativos por dia',states,'State context','Contexto por estado',issue_detail,'Product and issue context','Contexto de produto e problema','Complaint mix varies by product and geography, making unsegmented company rankings misleading.','O mix varia por produto e geografia, tornando rankings não segmentados enganosos.','Compare like-for-like product, period and geography before allocating service capacity.','Compare produto, período e geografia equivalentes antes de alocar capacidade de atendimento.'),
      ('trust','Data Trust','Confiança dos Dados','Evidence governance','Governança de evidências','What can and cannot be concluded from public complaint data?','O que pode e não pode ser concluído com dados públicos de reclamações?',[metric('rows','Rows modeled','Linhas modeladas',total,total,'integer','neutral'),metric('products','Products','Produtos',product_count,0,'integer','neutral'),core[2],metric('days','Coverage days','Dias cobertos',(end-start).days+1,(end-start).days+1,'integer','neutral')],trend,'Critical-field completeness','Completude dos campos críticos',products,'Product coverage','Cobertura de produtos',issue_detail,'Quality checks','Verificações de qualidade','The database is not statistically representative and has no customer or transaction denominator.','A base não é estatisticamente representativa e não possui denominador de clientes ou transações.','Never label a company best or worst from raw complaint volume; disclose recency and publication limitations.','Nunca classifique empresa como melhor ou pior pelo volume bruto; divulgue limitações de recência e publicação.')]
    pages=[]
    for spec in specs:
        pid,en,pt,een,ept,qen,qpt,metrics,tr,tren,trpt,bd,bden,bdpt,detail,den,dpt,fen,fpt,aen,apt=spec
        pages.append({'id':pid,'title':loc(en,pt),'eyebrow':loc(een,ept),'question':loc(qen,qpt),'metrics':metrics,'trendTitle':loc(tren,trpt),'trend':tr,'breakdownTitle':loc(bden,bdpt),'breakdown':bd,'detailTitle':loc(den,dpt),'detail':detail,'finding':loc(fen,fpt),'action':loc(aen,apt)})
    payload={'meta':{'source':'CFPB Consumer Complaint Database · CC0','period':f'{start} — {end}','builtAt':datetime.now(UTC).date().isoformat(),'rows':total,'limitations':loc('Complaint volume is not a rate and cannot measure company quality without customer or transaction exposure. Published narratives are consumer accounts scrubbed by CFPB.','Volume de reclamações não é taxa e não mede qualidade sem exposição de clientes ou transações. Relatos publicados são versões dos consumidores tratadas pelo CFPB.')},'filters':{'channels':[r[0] for r in con.execute('select distinct product from complaints order by 1').fetchall()],'devices':[r[0] for r in con.execute('select company from complaints group by 1 order by count(*) desc limit 50').fetchall()],'countries':[r[0] for r in con.execute('select distinct state from complaints where state is not null order by 1').fetchall()]},'pages':pages}
    (out/'dashboard.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
    con.execute(f"COPY (SELECT * FROM company_product_signal) TO '{(out/'mart_response_performance.parquet').as_posix()}' (FORMAT PARQUET,COMPRESSION ZSTD)")
    con.execute(f"""COPY (SELECT received_at::DATE received_date,product,sub_product,issue,sub_issue,company,state,
      submitted_via,company_response,
      CASE
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'identity|fraud|not mine|unauthorized') THEN 'Identity & fraud'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'credit report|incorrect information|score') THEN 'Credit reporting accuracy'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'payment|fee|interest|charge') THEN 'Payments & fees'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'collection|collector|debt') THEN 'Debt collection'
        WHEN regexp_matches(lower(coalesce(narrative,issue)),'close|cancel|access|blocked') THEN 'Account access'
        ELSE 'Other service issues' END topic,
      timely::INTEGER timely,(narrative IS NOT NULL)::INTEGER has_narrative,
      (company_response ILIKE '%monetary relief%')::INTEGER monetary_relief,complaint_id
      FROM complaints) TO '{(out/'mart_complaints.parquet').as_posix()}' (FORMAT PARQUET,COMPRESSION ZSTD)""")
    print(f'Built Clearline from {total:,} official complaint records')


def validate()->None:
    data=json.loads((ROOT/'public/data/dashboard.json').read_text(encoding='utf-8'))
    assert data['meta']['rows']>0 and len(data['pages'])==6
    assert 'not a rate' in data['meta']['limitations']['en']
    print('Clearline validation passed')


def main()->None:
    parser=argparse.ArgumentParser(); sub=parser.add_subparsers(dest='command',required=True)
    d=sub.add_parser('download');d.add_argument('--date-min',default='2025-01-01');d.add_argument('--date-max',default='2025-01-07')
    b=sub.add_parser('build');b.add_argument('--source',type=Path,default=RAW);sub.add_parser('validate');sub.add_parser('topics-audit');args=parser.parse_args()
    if args.command=='download':download(args.date_min,args.date_max)
    elif args.command=='build':build(args.source)
    elif args.command=='validate':validate()
    else:
        from .topics import audit_topics
        result=audit_topics(ROOT/'data/clearline.duckdb',ROOT/'public/data/topic_audit.json')
        print(f"Audited {result['sample_rows']:,} complaint texts with explainable rules")


if __name__=='__main__':main()
