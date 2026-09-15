# Dashboard quality review

## Decision contract

| Page | Primary question | Main evidence | Intended decision |
| --- | --- | --- | --- |
| Service Command | Which issues require operational attention? | Intake profile, timeliness and priority issue queue | Start bounded triage |
| Emerging Issues | Which issue groups changed recently? | Product- and issue-level volume movement | Select topics for investigation |
| Response Performance | Where is response timeliness weaker? | Timely response share in like-for-like context | Review process exceptions |
| Narrative Explorer | What explainable themes appear in narratives? | Rule-based topic groups and coverage | Route qualitative review |
| Product & Geography | Where is complaint composition concentrated? | Product, state and company context | Compare similar scopes, not overall quality |
| Data Trust | What conclusions are permitted? | Coverage, grain, denominator and source limitations | Prevent rankings and causal claims |

## Visual and analytical rules

- KPI cards summarize the selected scope; the daily chart describes only the observed seven-day profile.
- Three or seven observations are rendered as bars, not as a smoothed trend line.
- Bars show the current period and compact reference markers show the comparable prior period.
- Favorable and unfavorable movement is colored according to response and coverage semantics.
- The five-lens lab separates daily profile, volume drivers, timeliness, concentration and SLA scenario.
- Complaint volume is not a complaint rate and cannot rank company quality without an exposure denominator.

## Acceptance result

The dashboard passed Python data tests, Vitest component tests, Playwright interaction checks, desktop capture at 1440x900 and mobile capture at 390x844. Seven days support descriptive triage only, not seasonality, statistical control or causal claims.
