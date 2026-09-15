# Clearline data audit

Reviewed 2026-09-14 using `analysis/audit_clearline.py`.

| Check | Result |
|---|---:|
| Complaint rows | 74,076 |
| Distinct complaint IDs | 74,076 |
| Coverage | 2025-01-01 to 2025-01-07 |
| Critical key/date nulls | 0 |
| Binary flags outside 0/1 | 0 |
| Timely responses | 99.568% |
| Untimely responses | 320 |
| Published narratives | 20,330 (27.44%) |
| Monetary-relief classifications | 35,101 (47.39%) |
| Company-product rows | 103 unique groups |
| Minimum company-product sample | 25 |
| Company-product complaint coverage | 69,351 (93.62%) |

## Findings

- **High:** Generated dashboard metadata contained synthetic prior values derived from arbitrary multipliers. Runtime comparisons must come only from non-overlapping date windows. The generator now reserves static values for labels and metadata.
- **High:** Seven days are insufficient for robust anomaly detection, seasonality, or trend claims. The mean-plus-two-standard-deviations lens is descriptive triage only.
- **Medium:** The company-product mart excludes groups below 25 complaints. This is appropriate for minimum-sample comparisons but loses 6.38% of complaints and 11.45% of narratives.
- **Medium:** Narrative coverage is 27.44%, and topic assignment is deterministic keyword matching. Topic shares are sensitive to text availability and must not be interpreted as prevalence or truth.
- **Low:** The source contains 57 non-null `State` codes; user-facing language should call these jurisdictions rather than assume 57 US states.

The mart is qualified for portfolio demonstration and bounded operational triage. It has no customer, account, or transaction denominator and is not qualified for company-quality ranking, complaint-rate measurement, causal claims, or statistical trend monitoring.
