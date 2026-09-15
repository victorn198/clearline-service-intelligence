# Clearline analytical readout

Snapshot: 2025-01-01 to 2025-01-07. The mart contains 74,076 public CFPB complaints at one row per `complaint_id`.

## Executive answer

The latest three days contain 34,010 complaints, down 1.7% from 34,613 in the preceding three days. Timely response remained effectively stable at 99.565% versus 99.549%. Untimely responses declined from 156 to 148, while narrative coverage increased from 27.38% to 27.69% (+0.31 percentage points).

The volume decline was driven primarily by debt collection (-331 complaints) and credit cards (-170). Credit reporting, despite dominating intake, declined by only 62 records. This is a mix shift, not certified evidence of an overall improvement in consumer experience.

Across the full extract, credit reporting or other personal consumer reports account for 64,786 complaints, or 87.46% of the total. The top three products account for 95.57%, making aggregate results highly dependent on credit-reporting mix.

There are 320 untimely responses. Debt collection accounts for 114 (35.6%), credit reporting for 73 (22.8%), student loans for 53 (16.6%), and debt or credit management for 34 (10.6%). Together, these four products account for 85.6% of exceptions and form the most defensible operational queue.

## Narrative evidence

The extract contains 20,330 published narratives, or 27.44% coverage. Missing narratives for 72.56% of complaints prevent the text groups from representing the full population.

Explainable rules classify 47.57% as `Credit reporting accuracy`, 34.82% as `Other service issues`, and 10.44% as `Identity & fraud`. These are keyword triage groups, not statistical topics, verified facts, or regulatory findings. The rule uses narrative text when present and the structured issue otherwise, so differences in narrative coverage can shift the topic mix.

## Company comparisons

The company-product mart retains only groups with at least 25 complaints. It covers 69,351 complaints (93.62% of the total) and 18,002 narratives (88.55% of published narratives). Its totals must not be presented as full-population totals.

Comparisons are defensible only within the same product, period, and minimum-sample rule. Even then, they measure response behavior in the CFPB process, not overall company quality. No customer, account, transaction, or market-exposure denominator is available.

## Recommended sequence

1. Prioritize the 320 untimely exceptions, starting with the four products that account for 85.6% of them.
2. Investigate debt collection because it combines 114 exceptions with 97.39% timeliness.
3. Treat student loans and debt or credit management as investigation signals, but verify persistence over more than seven days.
4. Keep volume, timeliness, and narrative coverage separate; none substitutes for another.
5. Use topic groups only to sample records for human review.
6. Obtain external exposure denominators before calculating complaint rates or comparing company quality.

## Limitations

The extract covers only seven days, including a holiday and weekend. It is insufficient for seasonality, long-term trend, statistical process control, or robust change detection. The CFPB database is not statistically representative. Complaints are consumer allegations, and published narratives have passed CFPB privacy processing. The dashboard supports operational triage; it does not establish causality, prevalence, or an overall quality ranking.
