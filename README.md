# Clearline Service Intelligence

A financial-service operations case that turns official CFPB complaint data into issue detection, response monitoring, and explainable narrative triage.

![Clearline Service Command](docs/images/en/service-command.png)

## Business problem

Complaint dashboards often rank companies by raw volume, creating a false quality score. Clearline keeps names available for investigation but compares only defensible operational measures within product, period, and minimum-sample context.

## Data

- Official [CFPB Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/), CC0.
- Demo extract: 74,076 complaint records received from 1 to 7 Jan 2025.
- Published narratives are consumer accounts released after CFPB privacy processing.
- Complaint volume is not statistically representative and has no customer or transaction denominator.

## Decision experience

`Service Command` → `Emerging Issues` → `Response Performance` → `Narrative Explorer` → `Product & Geography` → `Data Trust`

The application supports issue triage, timely-response monitoring, product context, and explainable text groups. It does not label a company best or worst.

## Architecture

`CFPB filtered CSV API → Python/DuckDB → dbt marts → explainable topic rules → Parquet/JSON → React + ECharts`

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
npm install
python -m pipeline download --date-min 2025-01-01 --date-max 2025-01-07
python -m pipeline build
python -m pipeline topics-audit
npm run dev
```

Validate with `python -m pipeline validate`, `pytest`, `npm test`, `npm run build`, and `npm run test:e2e`.

## Portfolio evidence

- Official source provenance and public-data caveats.
- Operational response metrics with minimum sample thresholds.
- Deterministic narrative grouping with published rules, coverage audit, and no causal claim.
- No misleading company-quality league table.
- Bilingual responsive experience and evidence-oriented design.

## Client adaptation

A production version would combine CRM tickets, contact-center events, account exposure, SLA policies, and quality-review outcomes. [Discuss a similar project](mailto:comercial@wickoai.com.br).

See [Portuguese documentation](README.pt-BR.md), [complete dashboard guide](docs/DASHBOARD_GUIDE.md), [metric catalog](docs/METRIC_CATALOG.md), and [demo guide](docs/DEMO_GUIDE.md).
