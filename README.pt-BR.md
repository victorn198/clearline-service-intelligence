# Clearline Service Intelligence

## Documentação

- [Guia completo do dashboard](docs/DASHBOARD_GUIDE.pt-BR.md)
- [Catálogo de métricas](docs/METRIC_CATALOG.md)
- [Roteiro de demonstração](docs/DEMO_GUIDE.md)

![Comando de atendimento do Clearline](docs/images/pt/overview.png)

Case de operações de atendimento financeiro que transforma dados oficiais do CFPB em detecção de problemas, acompanhamento de resposta e triagem textual explicável.

## Problema de negócio

Rankear empresas por volume bruto de reclamações cria uma falsa nota de qualidade. O Clearline permite investigação por empresa, mas compara apenas métricas operacionais defensáveis dentro de produto, período e amostra mínima.

## Dados e arquitetura

- Fonte: [Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/) do CFPB, CC0.
- Demo com 74.076 reclamações oficiais de 1 a 7 de janeiro de 2025.
- Pipeline: `CSV oficial → Python/DuckDB → dbt → tópicos explicáveis → Parquet/JSON → React/ECharts`.
- Volume não é taxa e a base não possui denominador de clientes ou transações.

## Execução

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
npm install
python -m pipeline download --date-min 2025-01-01 --date-max 2025-01-07
python -m pipeline build
npm run dev
```

O case demonstra governança de evidências, métricas de resposta, análise textual interpretável, interface bilíngue e limitações explícitas. [Contato](mailto:comercial@wickoai.com.br).
