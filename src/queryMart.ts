import type { SeriesPoint } from './types'

export type FilterState = { channel: string; device: string; country: string }
export type MartResult = { current: Record<string, number>; previous: Record<string, number>; trend: SeriesPoint[] }
let connectionPromise: Promise<import('@duckdb/duckdb-wasm').AsyncDuckDBConnection> | undefined
const literal=(value:string)=>`'${value.replaceAll("'","''")}'`

async function connection(){
  if(!connectionPromise) connectionPromise=(async()=>{const d=await import('@duckdb/duckdb-wasm');const b=await d.selectBundle(d.getJsDelivrBundles());const workerUrl=URL.createObjectURL(new Blob([`importScripts("${b.mainWorker!}");`],{type:'text/javascript'}));const db=new d.AsyncDuckDB(new d.ConsoleLogger(),new Worker(workerUrl));await db.instantiate(b.mainModule,b.pthreadWorker);await db.registerFileURL('complaints.parquet',new URL('./data/mart_complaints.parquet',window.location.href).href,d.DuckDBDataProtocol.HTTP,false);return db.connect()})()
  return connectionPromise
}

export async function queryMart(filters:FilterState):Promise<MartResult>{
  const con=await connection();const clauses=[filters.channel&&`product=${literal(filters.channel)}`,filters.device&&`company=${literal(filters.device)}`,filters.country&&`state=${literal(filters.country)}`].filter(Boolean);const where=clauses.length?`where ${clauses.join(' and ')}`:''
  const metrics=async(period:'current'|'previous')=>{const op=period==='current'?'>=':'<';const t=await con.query(`with base as(select * from read_parquet('complaints.parquet') ${where}),bounds as(select min(received_date) lo,max(received_date) hi from base),scoped as(select b.* from base b,bounds where received_date ${op} lo+((hi-lo)/2)::integer) select count(*)::double complaints,avg(timely)::double timely,count(distinct company)::double companies,avg(has_narrative)::double narratives,avg(monetary_relief)::double relief,count(distinct product)::double products,count(distinct received_date)::double coverage_days from scoped`);const r=t.get(0) as Record<string,unknown>;return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Number(v??0)])) as Record<string,number>}
  const current=await metrics('current'),previous=await metrics('previous');const t=await con.query(`select strftime(received_date,'%b %d') as period_label,count(*)::double as metric_value from read_parquet('complaints.parquet') ${where} group by received_date order by received_date`);return{current,previous,trend:t.toArray().map(r=>({label:String(r.period_label),value:Number(r.metric_value)}))}
}
