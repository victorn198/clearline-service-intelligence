select company, product, count(*) as row_count
from {{ ref('mart_response_performance') }}
group by 1, 2
having count(*) > 1
