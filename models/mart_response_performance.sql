select
  company,
  product,
  complaints,
  timely_rate,
  monetary_relief_rate,
  narrative_count
from {{ source('raw', 'company_product_signal') }}
