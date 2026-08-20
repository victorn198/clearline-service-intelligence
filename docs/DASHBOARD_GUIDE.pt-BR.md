# Guia do dashboard Clearline

## Por que este case existe

O Clearline foi criado para equipes de atendimento, operações, risco e compliance transformarem reclamações em fila de investigação sem produzir rankings enganosos. A base oficial do CFPB foi escolhida por conter registros reais, taxonomias de produto e problema, campos de resposta, geografia e relatos tratados para privacidade.

A principal decisão analítica é a contenção: o volume bruto não possui denominador de clientes, contas ou transações. Portanto, ele é sinal de entrada, não taxa de reclamação nem nota de qualidade. Comparações ficam restritas a medidas operacionais dentro de produto, período e amostra mínima equivalentes.

DuckDB cria marts auditáveis, regras textuais explicáveis apoiam a triagem e o app React usa Parquet com DuckDB-WASM, sem banco pago continuamente.

## Fluxo de investigação

1. Comece em **Comando de Atendimento**.
2. Filtre por **Produto**, **Empresa** e **Estado** para criar contexto equivalente.
3. Use **Problemas Emergentes** para mudanças temáticas.
4. Use **Desempenho de Resposta** para execução de processo.
5. Leia evidências em **Explorador de Relatos**.
6. Consulte **Produto e Geografia** antes de alocar capacidade.
7. Revise **Confiança dos Dados** antes de qualquer afirmação externa.
8. Use **Restaurar visão de evidências** para voltar ao baseline.

## Dicionário de indicadores

| Indicador | Por que foi escolhido | Cálculo e granularidade | Interpretação correta |
|---|---|---|---|
| Reclamações recebidas | Mede carga de entrada | Contagem de registros oficiais | Volume no contexto; nunca taxa ou nota |
| Resposta no prazo | Mede execução do processo | Flag de pontualidade / reclamações | Parcela tratada dentro da janela CFPB |
| Empresas representadas | Expõe cobertura | Empresas distintas | Cobertura do extrato, não market share |
| Cobertura de relatos | Mede evidência qualitativa disponível | Relatos publicados não vazios / reclamações | Disponibilidade de texto, não veracidade |
| Parcela com compensação | Descreve um desfecho | Respostas com compensação monetária / reclamações | Composição de resposta, não perda ou justiça |
| Produtos | Expõe escopo da taxonomia | Produtos CFPB distintos | Amplitude da evidência |
| Dias cobertos | Expõe período | Data máxima - mínima + 1 | Profundidade histórica |
| Linhas modeladas | Torna o pipeline auditável | Reclamações modeladas | Cobertura de processamento |
| Sinal empresa-produto | Permite comparação defensável | Métricas por empresa-produto com pelo menos 25 registros | Contexto operacional apenas |

Alta de reclamações é atenção, não prova automática de piora. Alta de resposta no prazo é favorável. Coberturas são descritivas.

## Página por página

### 1. Comando de Atendimento

- **Objetivo:** identificar problemas que exigem atenção.
- **Cards:** carga, processo, cobertura, evidência e desfecho.
- **Entrada de reclamações:** revela picos e lacunas.
- **Mix de produtos:** explica a composição.
- **Fila de problemas:** combina produto, problema, volume, pontualidade e relatos.
- **Ação:** priorizar pares produto-problema com volume suficiente e pior resposta; nunca empresa por volume isolado.

### 2. Problemas Emergentes

- **Objetivo:** detectar temas ganhando relevância.
- **Sinal diário:** diferencia mudança recente, persistente ou isolada.
- **Concentração de problemas:** ordena a taxonomia oficial.
- **Evidências:** mostra contagem, resposta e relatos.
- **Ação:** escalar somente após confirmar participação, amostra e linguagem de suporte.

### 3. Desempenho de Resposta

- **Objetivo:** monitorar consistência da execução.
- **Resposta no prazo:** KPI principal.
- **Pontualidade no tempo:** revela estabilidade.
- **Resultados de resposta:** mostra composição dos desfechos.
- **Contexto empresa-produto:** restringe a comparação à granularidade e amostra defensáveis.
- **Ação:** investigar combinações adequadas e abaixo dos pares; não publicar ranking geral.

### 4. Explorador de Relatos

- **Objetivo:** ligar problemas estruturados à linguagem publicada.
- **Fluxo de relatos:** mostra quando existe evidência textual.
- **Grupos explicáveis:** regras para identidade e fraude, precisão de relatório, pagamentos e tarifas, cobrança e acesso.
- **Evidência textual:** fornece trechos tratados pelo CFPB.
- **Auditoria:** public/data/topic_audit.json publica regras e distribuição de uma amostra de 50 mil textos.
- **Ação:** tratar tópico como hipótese de revisão, não conclusão causal.

### 5. Produto e Geografia

- **Objetivo:** mostrar como produto e local alteram o cenário.
- **Entrada geográfica:** comportamento temporal.
- **Contexto por estado:** compara volume de evidências.
- **Contexto produto-problema:** impede que totais escondam mix.
- **Ação:** comparar segmentos equivalentes; população e exposição de clientes não existem.

### 6. Confiança dos Dados

- **Objetivo:** documentar o que pode ser concluído.
- **Cards:** linhas, produtos, empresas e dias.
- **Volume diário:** evidencia datas anormais.
- **Cobertura de produtos:** mostra concentração.
- **Checagens:** sustentam chaves, datas, nulos e amostra.
- **Verificação DuckDB-WASM:** lê o mart publicado de forma independente.
- **Ação:** qualificar ou interromper análise sem denominador, amostra, privacidade ou representatividade suficientes.

## Por que o design é institucional

Azul-marinho e bordô, conclusões sustentadas, cards contidos e limitações explícitas combinam com serviços financeiros. O design evita ranking celebratório e alertas agressivos que exagerariam os dados públicos.

## Limites

Volume não é taxa; a base não representa todos os clientes; nomes não implicam irregularidade; relatos não são fatos verificados; regras textuais não estabelecem causalidade; e compensação não mede perda, justiça ou qualidade de solução.

