-- Reproducible source contract for the official CFPB CSV extract.
select
  replace("Date received", 'Z', '')::timestamp as received_at,
  "Complaint ID"::bigint as complaint_id,
  "Product" as product,
  "Issue" as issue,
  "Company" as company,
  "State" as state,
  "Timely response?" = 'Yes' as timely,
  nullif("Consumer complaint narrative", '') as narrative
from read_csv_auto('data/raw/complaints.csv', header = true, all_varchar = true);
