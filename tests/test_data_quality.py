import json
from pathlib import Path

import duckdb


ROOT = Path(__file__).resolve().parents[1]
COMPLAINTS = ROOT / "public/data/mart_complaints.parquet"
RESPONSE = ROOT / "public/data/mart_response_performance.parquet"


def test_complaint_grain_keys_and_binary_flags():
    con = duckdb.connect()
    result = con.execute("""
        select count(*), count(distinct complaint_id),
          count(*) filter(where complaint_id is null or received_date is null
            or product is null or issue is null or company is null),
          count(*) filter(where timely not in (0,1) or has_narrative not in (0,1)
            or monetary_relief not in (0,1))
        from read_parquet(?)
    """, [str(COMPLAINTS)]).fetchone()
    assert result[0] == result[1]
    assert result[2:] == (0, 0)


def test_company_product_grain_and_threshold():
    con = duckdb.connect()
    result = con.execute("""
        select count(*), count(distinct (company,product)), min(complaints),
          count(*) filter(where company is null or product is null)
        from read_parquet(?)
    """, [str(RESPONSE)]).fetchone()
    assert result[0] == result[1]
    assert result[2] >= 25
    assert result[3] == 0


def test_dashboard_scope_reconciles_to_complaint_mart():
    dashboard = json.loads((ROOT / "public/data/dashboard.json").read_text(encoding="utf-8"))
    rows = duckdb.connect().execute("select count(*) from read_parquet(?)", [str(COMPLAINTS)]).fetchone()[0]
    assert dashboard["meta"]["rows"] == rows


def test_report_exposes_material_limitations():
    audit = (ROOT / "docs/DATA_AUDIT.md").read_text(encoding="utf-8").lower()
    for phrase in ("seven days", "minimum-sample", "narrative coverage", "denominator"):
        assert phrase in audit
