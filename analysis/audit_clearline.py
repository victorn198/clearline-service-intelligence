from __future__ import annotations

import json
from pathlib import Path

import duckdb


ROOT = Path(__file__).resolve().parents[1]
COMPLAINTS = ROOT / "public/data/mart_complaints.parquet"
RESPONSE = ROOT / "public/data/mart_response_performance.parquet"


def fetch(con: duckdb.DuckDBPyConnection, sql: str, path: Path) -> list[dict[str, object]]:
    cursor = con.execute(sql, [str(path)])
    columns = [item[0] for item in cursor.description]
    return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]


def main() -> None:
    con = duckdb.connect()
    checks = {
        "profile": fetch(con, """
            select count(*) as row_count, count(distinct complaint_id) as id_count,
              min(received_date) min_date, max(received_date) max_date,
              count(distinct received_date) as coverage_days,
              count(distinct product) as product_count,
              count(distinct issue) as issue_count,
              count(distinct company) as company_count,
              count(distinct state) as state_count
            from read_parquet(?)
        """, COMPLAINTS),
        "missingness": fetch(con, """
            select count(*) filter(where complaint_id is null) id_null,
              count(*) filter(where received_date is null) date_null,
              count(*) filter(where product is null or trim(product)='') product_null,
              count(*) filter(where issue is null or trim(issue)='') issue_null,
              count(*) filter(where company is null or trim(company)='') company_null,
              count(*) filter(where state is null or trim(state)='') state_null
            from read_parquet(?)
        """, COMPLAINTS),
        "binary_validity": fetch(con, """
            select min(timely) timely_min, max(timely) timely_max,
              min(has_narrative) narrative_min, max(has_narrative) narrative_max,
              min(monetary_relief) relief_min, max(monetary_relief) relief_max
            from read_parquet(?)
        """, COMPLAINTS),
        "kpis": fetch(con, """
            select count(*) as complaint_count, avg(timely)::double as timely_rate,
              sum(1-timely) as untimely_count,
              avg(has_narrative)::double as narrative_rate,
              sum(has_narrative) as narrative_count,
              avg(monetary_relief)::double as relief_rate,
              sum(monetary_relief) as relief_count
            from read_parquet(?)
        """, COMPLAINTS),
        "daily": fetch(con, """
            select received_date, count(*) as complaints, avg(timely)::double as timely_rate,
              sum(1-timely) as untimely, avg(has_narrative)::double as narrative_rate
            from read_parquet(?) group by 1 order by 1
        """, COMPLAINTS),
        "latest_three_days": fetch(con, """
            with bounds as (
              select min(received_date) lo, max(received_date) hi from read_parquet(?)
            )
            select
              count(*) filter(where received_date between hi-2 and hi) current_complaints,
              count(*) filter(where received_date between hi-5 and hi-3) previous_complaints,
              avg(timely) filter(where received_date between hi-2 and hi)::double current_timely_rate,
              avg(timely) filter(where received_date between hi-5 and hi-3)::double previous_timely_rate,
              sum(1-timely) filter(where received_date between hi-2 and hi) current_untimely,
              sum(1-timely) filter(where received_date between hi-5 and hi-3) previous_untimely,
              avg(has_narrative) filter(where received_date between hi-2 and hi)::double current_narrative_rate,
              avg(has_narrative) filter(where received_date between hi-5 and hi-3)::double previous_narrative_rate
            from read_parquet(?), bounds
        """.replace("read_parquet(?), bounds", f"read_parquet('{COMPLAINTS.as_posix()}'), bounds"), COMPLAINTS),
        "three_day_product_drivers": fetch(con, """
            with bounds as (select max(received_date) hi from read_parquet(?))
            select product,
              count(*) filter(where received_date between hi-2 and hi) current_complaints,
              count(*) filter(where received_date between hi-5 and hi-3) previous_complaints,
              count(*) filter(where received_date between hi-2 and hi)
                - count(*) filter(where received_date between hi-5 and hi-3) change
            from read_parquet(?), bounds group by 1 order by abs(change) desc
        """.replace("read_parquet(?), bounds", f"read_parquet('{COMPLAINTS.as_posix()}'), bounds"), COMPLAINTS),
        "products": fetch(con, """
            select product, count(*) as complaints,
              round(100*count(*)/sum(count(*)) over(),2) share_pct,
              avg(timely)::double as timely_rate, sum(1-timely) as untimely,
              avg(has_narrative)::double as narrative_rate
            from read_parquet(?) group by 1 order by 2 desc
        """, COMPLAINTS),
        "topics": fetch(con, """
            select topic, count(*) as complaints,
              round(100*count(*)/sum(count(*)) over(),2) share_pct,
              avg(timely)::double as timely_rate,
              avg(has_narrative)::double as narrative_rate
            from read_parquet(?) group by 1 order by 2 desc
        """, COMPLAINTS),
        "issues": fetch(con, """
            select issue, count(*) as complaints,
              round(100*count(*)/sum(count(*)) over(),2) share_pct,
              avg(timely)::double as timely_rate
            from read_parquet(?) group by 1 order by 2 desc limit 15
        """, COMPLAINTS),
        "company_exceptions": fetch(con, """
            select company, count(*) as complaints, avg(timely)::double as timely_rate,
              sum(1-timely) as untimely, avg(has_narrative)::double as narrative_rate
            from read_parquet(?) group by 1 having count(*)>=100
            order by untimely desc, complaints desc limit 20
        """, COMPLAINTS),
        "response_grain": fetch(con, """
            select count(*) as row_count, count(distinct (company,product)) distinct_grain,
              count(*) filter(where company is null or product is null) key_nulls,
              min(first_date) first_date, max(last_date) last_date,
              min(complaints) minimum_group, max(complaints) maximum_group
            from read_parquet(?)
        """, RESPONSE),
        "response_reconciliation": fetch(con, """
            select sum(complaints) complaints_in_groups,
              sum(narrative_count) narratives_in_groups
            from read_parquet(?)
        """, RESPONSE),
    }
    print(json.dumps(checks, indent=2, default=str))


if __name__ == "__main__":
    main()
