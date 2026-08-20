# Clearline dashboard guide

## Why this case exists

Clearline was designed for service, operations, risk, and compliance teams that need to turn complaint evidence into an investigation queue without creating misleading company rankings. The official CFPB database was chosen because it contains real public records, structured product and issue taxonomies, operational response fields, geography, and privacy-processed narratives.

The central analytical choice is restraint: raw complaint volume has no customer, account, or transaction denominator. It is therefore an intake signal, not a complaint rate or quality score. Comparisons are limited to operational response measures inside equivalent product, period, and minimum-sample contexts.

DuckDB creates auditable marts, explainable text rules support triage, and the static React app uses compact Parquet with DuckDB-WASM so the public demo needs no continuously paid database.

## Investigation workflow

1. Start in **Service Command** to identify the largest operational signal.
2. Filter by **Product**, **Company**, and **State** to create a like-for-like context.
3. Open **Emerging Issues** when the problem appears thematic.
4. Open **Response Performance** when the problem concerns process execution.
5. Use **Narrative Explorer** to read supporting consumer language.
6. Use **Product & Geography** before allocating capacity.
7. Review **Data Trust** before making any external statement.
8. Use **Restore evidence view** to return to the defensible baseline.

## Indicator dictionary

| Indicator | Why it was chosen | Calculation and grain | Correct interpretation |
|---|---|---|---|
| Complaints received | Measures intake workload | Count of official complaint records | Volume in the selected context, never a rate or quality score |
| Timely response | Measures process execution | CFPB timely flag / complaints | Share handled within the CFPB process window |
| Companies represented | Exposes market coverage | Distinct company names | Coverage of the extract, not market share |
| Narrative coverage | Measures available qualitative evidence | Non-empty published narratives / complaints | Availability of text for review, not truthfulness |
| Monetary relief share | Describes one response outcome | Monetary-relief responses / complaints | Operational response composition, not consumer loss or compensation adequacy |
| Products | Exposes taxonomy scope | Distinct CFPB products | Breadth of the selected evidence |
| Coverage days | Exposes time window | Maximum received date - minimum date + 1 | Historical depth, not currentness |
| Rows modeled | Makes pipeline scope auditable | Count of modeled complaints | Data-processing coverage |
| Company-product signal | Enables defensible comparison | Metrics at company-product grain with at least 25 records | Operational context only |

For **Complaints received**, an increase is treated as attention/risk, not automatically deterioration. For **Timely response**, an increase is favorable. Other coverage metrics are descriptive and must not be moralized.

## Page-by-page reference

### 1. Service Command

**Purpose:** identify which service issues require operational attention.

- **KPI row:** complaint intake, timely response, company coverage, narrative coverage, and monetary relief provide workload, process, evidence, and outcome context.
- **Complaint intake:** shows daily volume and reveals bursts or reporting gaps.
- **Product mix:** identifies which products explain the selected intake.
- **Priority issue queue:** combines product, issue, complaint volume, timely-response percentage, and narrative count.
- **Action:** prioritize high-volume product-issue pairs with weaker response performance; do not prioritize a company from volume alone.

### 2. Emerging Issues

**Purpose:** detect themes that may be gaining operational relevance.

- **KPI row:** establishes volume, process, coverage, and evidence under the selected filters.
- **Daily issue signal:** shows whether the change is recent, persistent, or isolated.
- **Issue concentration:** ranks the structured CFPB issue taxonomy.
- **Issue evidence:** exposes counts, response behavior, and narrative availability behind the ranking.
- **Action:** escalate only after confirming share change, sample size, and supporting narratives.

### 3. Response Performance

**Purpose:** monitor whether response execution is consistent.

- **Timely response:** primary process KPI.
- **Complaints and companies:** provide denominator and coverage context.
- **Narrative and monetary-relief shares:** describe evidence and outcome composition.
- **Timeliness over time:** reveals process stability.
- **Response outcomes:** shows the distribution of company response categories.
- **Company-product context:** limits comparison to a defensible grain and minimum sample.
- **Action:** investigate combinations with adequate volume and below-peer timeliness; never publish an overall league table from this data.

### 4. Narrative Explorer

**Purpose:** connect structured issues to explainable published consumer language.

- **KPI row:** volume, narrative coverage, and timely response define the usable text sample.
- **Published narrative flow:** shows when qualitative evidence is available.
- **Explainable topic groups:** applies deterministic keyword groups such as identity and fraud, reporting accuracy, payments and fees, debt collection, and account access.
- **Narrative evidence:** provides privacy-processed excerpts for human review.
- **Topic audit:** public/data/topic_audit.json publishes the rules and their distribution across a 50,000-row audit sample.
- **Action:** use a topic as a review hypothesis, not a factual or causal conclusion.

### 5. Product & Geography

**Purpose:** show how product and location change the service picture.

- **KPI row:** keeps volume and response context visible.
- **Geographic intake:** shows the time pattern for the selected geography.
- **State context:** compares evidence volume by state.
- **Product and issue context:** prevents geographic totals from hiding product mix.
- **Action:** allocate review capacity using equivalent product-period-geography segments; population or customer exposure is absent.

### 6. Data Trust

**Purpose:** document what can and cannot be concluded.

- **Rows modeled, products, companies, and coverage days:** expose scope.
- **Daily source volume:** reveals missing or abnormal source dates.
- **Product coverage:** shows taxonomy concentration.
- **Quality checks:** provides evidence for key, date, null, and sample-threshold checks.
- **DuckDB-WASM verification:** independently reads the published mart in the browser.
- **Action:** qualify or stop the analysis when denominator, sample, privacy, or representativeness requirements are not met.

## Why the visual design is institutional

The navy and burgundy palette, evidence statements, restrained cards, and explicit limitations support a financial-service context. The design deliberately avoids celebratory rankings, gamification, and aggressive alert colors that could overstate public complaint data.

## What the dashboard does not claim

- Complaint volume is not a complaint rate.
- The database is not statistically representative of all customers.
- Company names do not imply wrongdoing.
- Narratives are consumer accounts, not independently verified facts.
- Topic rules support triage and do not establish causality or regulatory findings.
- Monetary relief share does not measure loss, fairness, or resolution quality.

