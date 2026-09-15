import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronRight, ChevronUp, CircleGauge, Download, ExternalLink, Languages, MapPinned, MessageSquareText, Radar, RotateCcw, Route, Search, ShieldCheck, TimerReset } from 'lucide-react'
import { BarChart, DataGrid, DecisionNote, MetricCard, TrendChart } from './components'
import { ui } from './i18n'
import { MartVerifier } from './MartVerifier'
import { queryMart, type DrillItem, type MartResult } from './queryMart'
import { PageInsight } from './innovation'
import type { DashboardData, Lang } from './types'

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('clearline-lang') as Lang) || 'en')
  const [pageId, setPageId] = useState('service')
  const [filters, setFilters] = useState({ channel: '', device: '', country: '', period:'3' as '1'|'3'|'all' })
  const [mart, setMart] = useState<MartResult | null>(null)
  const [queryState,setQueryState]=useState<'loading'|'ready'|'error'>('loading')
  const [drillPath,setDrillPath]=useState<DrillItem[]>([])
  useEffect(() => { fetch('./data/dashboard.json').then(r => r.json()).then(setData) }, [])
  useEffect(() => { localStorage.setItem('clearline-lang', lang); document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en' }, [lang])
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }) }, [pageId])
  useEffect(()=>{let active=true;setMart(null);setQueryState('loading');queryMart(filters,pageId,drillPath).then(result=>{if(active){setMart(result);setQueryState('ready')}}).catch(error=>{console.error(error);if(active)setQueryState('error')});return()=>{active=false}},[filters.channel,filters.device,filters.country,filters.period,pageId,drillPath])
  if (!data) return <main className="loading"><Activity className="spin" /> Loading Clearline...</main>
  const page = data.pages.find(p => p.id === pageId) ?? data.pages[0]
  const metrics = mart ? page.metrics.map(metric => ({...metric,value:mart.current[metric.id]??0,previous:mart.context.comparisonAvailable?(mart.previous[metric.id]??0):0})) : []
  const trend = mart?.trend ?? []
  const breakdown=mart?.breakdown??[],detail=mart?.detail??[]
  const findingByPage:Record<string,{en:string;pt:string}> = mart ? {
    service:{en:`${mart.context.topDriver} represents ${(mart.context.topShare*100).toFixed(1)}% of scoped intake; ${Math.round(mart.current.untimely??0).toLocaleString()} responses are outside the timely flag.`,pt:`${mart.context.topDriver} representa ${(mart.context.topShare*100).toFixed(1)}% da entrada; ${Math.round(mart.current.untimely??0).toLocaleString('pt-BR')} respostas estão fora do prazo.`},
    issues:{en:`${mart.context.topDriver} is the leading issue group at ${(mart.context.topShare*100).toFixed(1)}% of scoped issue volume.`,pt:`${mart.context.topDriver} lidera os problemas com ${(mart.context.topShare*100).toFixed(1)}% do volume do recorte.`},
    response:{en:`${mart.context.topDriver} is the leading response outcome; scoped timeliness is ${((mart.current.timely??0)*100).toFixed(1)}%.`,pt:`${mart.context.topDriver} é o principal resultado de resposta; o prazo no recorte é ${((mart.current.timely??0)*100).toFixed(1)}%.`},
    narratives:{en:`${mart.context.topDriver} leads the explainable topic mix; narrative coverage is ${((mart.current.narratives??0)*100).toFixed(1)}%.`,pt:`${mart.context.topDriver} lidera o mix de tópicos; a cobertura de relatos é ${((mart.current.narratives??0)*100).toFixed(1)}%.`},
    context:{en:`${mart.context.topDriver} leads the geographic scope, across ${Math.round(mart.current.states??0)} represented jurisdictions.`,pt:`${mart.context.topDriver} lidera o recorte geográfico, em ${Math.round(mart.current.states??0)} jurisdições representadas.`},
    trust:{en:`${Math.round(mart.current.rows??0).toLocaleString()} rows cover ${Math.round(mart.current.days??0)} source days in the selected scope.`,pt:`${Math.round(mart.current.rows??0).toLocaleString('pt-BR')} linhas cobrem ${Math.round(mart.current.days??0)} dias da fonte no recorte.`}
  } : {}
  const finding=mart?(findingByPage[page.id]?.[lang]??page.finding[lang]):page.finding[lang]
  const actionByPage:Record<string,{en:string;pt:string}>={
    service:{en:'Review recent intake changes together with timeliness and product context; do not interpret raw volume as quality.',pt:'Revise mudanças recentes nas entradas junto com prazo e contexto de produto; não interprete volume bruto como qualidade.'},
    issues:{en:'Assign the leading issue changes for review and verify persistence before escalating root-cause work.',pt:'Atribua as principais mudanças para revisão e confirme persistência antes de escalar causa raiz.'},
    response:{en:'Prioritize untimely exceptions and compare companies only within the same product, period and sample threshold.',pt:'Priorize exceções fora do prazo e compare empresas apenas no mesmo produto, período e corte de amostra.'},
    narratives:{en:'Expand narrative review where coverage is low, then validate topics against source text before action.',pt:'Amplie a revisão onde a cobertura é baixa e valide os tópicos contra o texto antes de agir.'},
    context:{en:'Use like-for-like product and period filters; obtain an external customer denominator before calculating rates.',pt:'Use filtros equivalentes de produto e período; obtenha denominador externo antes de calcular taxas.'},
    trust:{en:'Block interpretation when a critical check fails and keep source limitations visible in every decision.',pt:'Bloqueie a interpretação quando um teste crítico falhar e mantenha as limitações visíveis.'}
  }
  const action=actionByPage[page.id]?.[lang]??page.action[lang]
  const t = ui[lang]
  const comparisonAvailable=mart?.context.comparisonAvailable??false
  const comparisonLabel=comparisonAvailable?(lang==='pt'?`vs. ${filters.period} dias anteriores`:`vs. previous ${filters.period} days`):(lang==='pt'?'sem janela anterior':'no prior window')
  const trendDirection:Record<string,'up'|'down'|'neutral'>={service:'down',issues:'down',response:'up',narratives:'up',context:'neutral',trust:'up'}
  const breakdownDirection:Record<string,'up'|'down'|'neutral'>={service:'down',issues:'down',response:'neutral',narratives:'up',context:'neutral',trust:'neutral'}
  const select = (label: string, key: keyof typeof filters, values: string[]) => <label className="filter"><span>{label}</span><div><select disabled={queryState==='loading'} value={filters[key]} onChange={e => {setDrillPath([]);setFilters(v => ({ ...v, [key]: e.target.value }))}}><option value="">{t.all}</option>{values.map(v => <option key={v}>{v}</option>)}</select><ChevronDown size={15} /></div></label>
  const changePage=(id:string)=>{setPageId(id);setDrillPath([])},drill=(name:string)=>{if(mart?.context.canDrill)setDrillPath(path=>[...path,{dimension:mart.context.dimension as DrillItem['dimension'],value:name}])}
  const pageIcons=[CircleGauge,Radar,TimerReset,MessageSquareText,MapPinned,ShieldCheck]
  const exportEvidence=()=>{const rows=detail.length?detail:[];if(!rows.length)return;const keys=Object.keys(rows[0]);const csv=[keys.join(','),...rows.map(row=>keys.map(key=>`"${String(row[key]??'').replaceAll('"','""')}"`).join(','))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`clearline-${page.id}.csv`;link.click();URL.revokeObjectURL(url)}
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Route /></span><span><b>Clearline</b><small>Evidence operations</small></span></a><label className="sidebar-search"><Search size={15}/><input aria-label={lang==='pt'?'Buscar painel':'Search dashboard'} placeholder={lang==='pt'?'Buscar painel...':'Search dashboard...'}/></label><nav>{data.pages.map((p,index) => {const Icon=pageIcons[index];return <button data-index={`0${index+1}`} className={p.id === page.id ? 'active' : ''} onClick={() => changePage(p.id)} key={p.id}><Icon size={17}/><span>{p.title[lang]}</span><ChevronRight size={14}/></button>})}</nav><div className="sidebar-foot"><span>{lang==='pt'?'Fonte pública verificável':'Verifiable public source'}</span><b>CFPB · CC0</b><a href="mailto:victorn198@outlook.com">{t.contact}<ExternalLink size={13}/></a></div></header>
    <main id="top">
      <section className="workspace-bar"><div className="breadcrumb"><span>Dashboard</span><ChevronRight size={15}/><b>{page.title[lang]}</b></div><div><button className="export-view" onClick={exportEvidence}><Download size={16}/>{lang==='pt'?'Exportar evidências':'Export evidence'}</button><button className="language" onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}><Languages size={17} />{lang === 'en' ? 'PT' : 'EN'}</button></div></section>
      <section className="report-summary"><div className="report-summary-head"><div><span>{page.eyebrow[lang]}</span><h1>{page.title[lang]}</h1><p>{page.question[lang]}</p></div><div className="report-meta"><span>{t.source}</span><b>{data.meta.source}</b><small>{data.meta.period}</small></div></div><section className="filterbar"><div className="filter-heading"><span>{t.filters}</span><small>{data.meta.rows.toLocaleString()} rows</small></div><label className="filter"><span>{lang==='pt'?'Período':'Period'}</span><div><select value={filters.period} onChange={e=>{setDrillPath([]);setFilters(v=>({...v,period:e.target.value as typeof filters.period}))}}><option value="1">{lang==='pt'?'Último dia':'Last day'}</option><option value="3">{lang==='pt'?'Últimos 3 dias':'Last 3 days'}</option><option value="all">{lang==='pt'?'Todo histórico (sem comparação)':'All history (no comparison)'}</option></select><ChevronDown size={15}/></div></label>{select(t.channel, 'channel', data.filters.channels)}{select(t.device, 'device', data.filters.devices)}{select(t.country, 'country', data.filters.countries)}<button className="reset" onClick={() => {setDrillPath([]);setFilters({ channel: '', device: '', country: '',period:'3' })}}><RotateCcw size={15} />{t.reset}</button></section><section className="metrics">{metrics.map(metric => <MetricCard key={metric.id} metric={metric} lang={lang} prior={comparisonLabel} comparisonAvailable={comparisonAvailable} />)}</section></section>
      {queryState==='loading'&&<div className="loading" role="status">{lang==='pt'?'Calculando o recorte selecionado...':'Calculating selected scope...'}</div>}
      {queryState==='error'&&<div className="query-error" role="alert">{lang==='pt'?'Não foi possível recalcular o recorte.':'The selected scope could not be recalculated.'}</div>}
      {queryState==='ready'&&mart&&<>
      <section className="decision-strip executive-decision"><DecisionNote title={t.finding}>{finding}</DecisionNote><DecisionNote title={t.action} action>{action}</DecisionNote></section>
      <section className="situation-board"><article className="signal-stage"><div className="stage-head"><div><span>{lang==='pt'?'TENDÊNCIA DO RECORTE':'SCOPE TREND'}</span><h2>{page.trendTitle[lang]}</h2></div><small>{lang==='pt'?'Evidência observada, não previsão':'Observed evidence, not a forecast'}</small></div><TrendChart data={trend} lang={lang} direction={trendDirection[page.id]} valueFormat={page.id==='response'||page.id==='trust'?'percent':'number'} /></article></section>
      <section className="evidence-workbench"><article className="panel breakdown-panel"><div className="panel-title"><h2>{page.breakdownTitle[lang]}</h2><span>{lang==='pt'?'Navegue pela hierarquia':'Navigate the hierarchy'}</span></div><div className="drillbar"><span>{lang==='pt'?'Caminho':'Path'}: <b>{mart?.context.dimension??'product'}</b>{drillPath.map(item=><i key={`${item.dimension}-${item.value}`}> / {item.value}</i>)}</span><div><button disabled={!drillPath.length} onClick={()=>setDrillPath(path=>path.slice(0,-1))}><ChevronUp/>{lang==='pt'?'Voltar nível':'Drill up'}</button><button disabled={!drillPath.length} onClick={()=>setDrillPath([])}><RotateCcw/>{lang==='pt'?'Início':'Reset'}</button></div></div><BarChart data={breakdown} lang={lang} onSelect={drill} direction={breakdownDirection[page.id]}/></article><section className="panel detail"><div className="panel-title"><h2>{page.detailTitle[lang]}</h2><span>{t.details}</span></div><DataGrid rows={detail} pageId={page.id}/></section></section>
      <PageInsight pageId={page.id} values={mart.current} previous={comparisonAvailable?mart.previous:mart.current} trend={trend} breakdown={breakdown} detail={detail} lang={lang}/>
      <section className="trust"><div><h2>{t.trust}</h2><p>{data.meta.limitations[lang]}</p>{page.id === 'trust' && <MartVerifier file="mart_response_performance.parquet" lang={lang}/>}</div><div><span>Built</span><b>{data.meta.builtAt}</b></div><div><span>Rows</span><b>{data.meta.rows.toLocaleString()}</b></div></section>
      </>}
    </main>
    <footer><span>Clearline · Portfolio case by Victor N.</span><a href="mailto:victorn198@outlook.com">{t.contact}<ExternalLink size={14} /></a></footer>
  </div>
}
