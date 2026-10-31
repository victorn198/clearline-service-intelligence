# Clearline Service Intelligence

**[Abrir demo ao vivo](https://clearline-service-intelligence.pages.dev/)** · [Read in English](README.md)

## Documentação

- [Guia completo do dashboard](docs/DASHBOARD_GUIDE.pt-BR.md)
- [Catálogo de métricas](docs/METRIC_CATALOG.md)
- [Roteiro de demonstração](docs/DEMO_GUIDE.md)
- [Leitura analítica em português](docs/ANALYSIS_READOUT.pt-BR.md)
- [Auditoria dos dados](docs/DATA_AUDIT.md)
- [Revisão de qualidade](docs/DASHBOARD_QUALITY_REVIEW.md)

![Comando de atendimento do Clearline](docs/images/pt/overview.png)

Case de operações de atendimento financeiro que transforma dados oficiais do CFPB em detecção de problemas, acompanhamento de resposta e triagem textual explicável.

## Problema de negócio

Rankear empresas por volume bruto de reclamações cria uma falsa nota de qualidade. O Clearline permite investigação por empresa, mas compara apenas métricas operacionais defensáveis dentro de produto, período e amostra mínima.

## Dados e arquitetura

- Fonte: [Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/) do CFPB, CC0.
- Demo com 74.076 reclamações oficiais de 1 a 7 de janeiro de 2025.
- Pipeline: `CSV oficial → Python/DuckDB → dbt → tópicos explicáveis → Parquet/JSON → React/ECharts`.
- Volume não é taxa e a base não possui denominador de clientes ou transações.

## Laboratório de evidências

Todas as páginas usam cinco lentes complementares, sem repetir os números dos cards. A página de comando cobre:

- **Perfil diário** mostra maior dia observado, amplitude e média descritiva sem alegar controle estatístico com apenas sete dias.
- **Drivers** atribui mudanças absolutas contra a janela anterior aos produtos.
- **Prazo** traduz a taxa elevada no volume estimado de exceções remanescentes.
- **Concentração** calcula participação do Top 3 e HHI sem tratar volume como nota de qualidade.
- **Cenário** estima o efeito operacional de reduzir atrasos; não é previsão nem afirmação causal.

Os laboratórios secundários são próprios para momento e triagem de temas, exceções e sensibilidade de SLA, cobertura e lacunas de revisão textual, contexto comparável de produto/geografia/empresa e completude, limites, reconciliação e prontidão das evidências.

## Execução

### Clearline 2.0: laboratório semântico de relatos

Abra **Laboratório Semântico** na navegação existente ou use `/?view=semantic&lang=pt` (`lang=en` para inglês). Compare as regras por palavras-chave com inferência real de similaridade semântica MiniLM q8 / WASM no navegador, revise 200 relatos públicos CFPB rastreáveis, aplique/desfaça correções na sessão da aba e exporte o recorte atual em CSV/JSON. Uma área isolada para colar texto em inglês usa o mesmo modelo local sem entrar nas contagens ou exportações CFPB. O download do modelo começa apenas com uma ação explícita de análise; o texto é processado localmente. Os painéis existentes funcionam sem o modelo.

A revisão do modelo e o runtime Transformers.js 3.8.1 estão fixados. Similaridade não é probabilidade; resultados fracos ou próximos ficam incertos. A amostra inclui deliberadamente mais exceções de produto e prazo e não é representativa. Os indicadores operacionais usam resposta no prazo e compensação monetária, sem inventar duração de resolução ou valores de reembolso. Consulte o [método, procedência, avaliação e guia de QA do owner](docs/SEMANTIC_LAB.md).

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
npm install
python -m pipeline download --date-min 2025-01-01 --date-max 2025-01-07
python -m pipeline build
npm run dev
```

O case demonstra governança de evidências, métricas de resposta, análise textual interpretável, interface bilíngue e limitações explícitas. [Contato](mailto:victorn198@outlook.com).
## Inovação de design

O **Gráfico de Controle de Sinais** separa variação esperada de dias acima de um limite estatístico de atenção. Ele apoia triagem sem apresentar volume de reclamações como causalidade, prevalência ou nota de qualidade da empresa.
