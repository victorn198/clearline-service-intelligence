import { useMemo, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart as EBarChart, LineChart as ELineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LegacyGridContainLabel } from 'echarts/features'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ArrowDownRight, ArrowUpRight, Database, MoveRight } from 'lucide-react'
import type { Lang, Metric, SeriesPoint, BreakdownRow } from './types'

echarts.use([EBarChart, ELineChart, GridComponent, TooltipComponent, LegacyGridContainLabel, CanvasRenderer])

const number = (value: number, format: Metric['format'], lang: Lang) => {
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
  if (format === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: format === 'decimal' ? 1 : 0, notation: value > 999999 ? 'compact' : 'standard' }).format(value)
}

export function MetricCard({ metric, lang, prior, comparisonAvailable = true }: { metric: Metric; lang: Lang; prior: string; comparisonAvailable?: boolean }) {
  const delta = metric.previous === 0 ? 0 : (metric.value - metric.previous) / Math.abs(metric.previous)
  const good = metric.improvement === 'up' ? delta >= 0 : delta <= 0
  const tone = metric.improvement === 'neutral' ? 'neutral' : good ? 'good' : 'bad'
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return <article className="metric-card">
    <div className="metric-label"><span>{metric.label[lang]}</span><Database size={15} aria-hidden="true" /></div>
    <strong>{number(metric.value, metric.format, lang)}</strong>
    {comparisonAvailable ? <div className={`delta ${tone}`}><Icon size={15} /><span>{number(Math.abs(delta), 'percent', lang)}</span><small>{prior}</small></div> : <div className="delta neutral"><span>—</span><small>{prior}</small></div>}
  </article>
}

type Direction = 'up' | 'down' | 'neutral'

export function TrendChart({ data, lang, direction = 'neutral', valueFormat = 'number' }: { data: SeriesPoint[]; lang: Lang; direction?: Direction; valueFormat?: 'number'|'percent' }) {
  const [mode, setMode] = useState<'value'|'index'|'change'>('value')
  const base = data[0]?.value || 1
  const rawValues = data.map(point => point.value)
  const current = rawValues.at(-1) ?? 0
  const minimum = rawValues.length ? Math.min(...rawValues) : 0
  const maximum = rawValues.length ? Math.max(...rawValues) : 0
  const movement = base ? (current - base) / Math.abs(base) : 0
  const discrete = data.length <= 7
  const values = data.map((point, index) => mode === 'index' ? point.value / base * 100 : mode === 'change' ? (index ? (point.value - data[index - 1].value) / Math.abs(data[index - 1].value || 1) * 100 : 0) : point.value)
  const format = (value: number) => mode === 'value' ? (valueFormat === 'percent' ? `${value.toFixed(1)}%` : new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)) : `${value.toFixed(1)}${mode === 'change' ? '%' : ''}`
  const movementTone = direction === 'neutral' || movement === 0 ? 'neutral' : (direction === 'up' ? movement > 0 : movement < 0) ? 'positive' : 'negative'
  const option = { animation: false, grid: { left: 12, right: 22, top: 24, bottom: 18, containLabel: true }, tooltip: { trigger: 'axis', backgroundColor:'#171f32',borderColor:'#2b3853',textStyle:{color:'#f7f9ff'},valueFormatter: format }, xAxis: { type: 'category', data: data.map(d => d.label), boundaryGap: discrete, axisLine: { lineStyle: { color: '#2b3853' } }, axisLabel: { color: '#91a0bc' } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#202a3e' } }, axisLabel: { color: '#91a0bc', formatter: format } }, series: [discrete?{type:'bar',data:values,barMaxWidth:46,itemStyle:{color:'#3978ff',borderRadius:[4,4,0,0]},emphasis:{disabled:true}}:{ type: 'line', data: values, smooth: .28, symbolSize: 7, lineStyle: { width: 3, color: '#3978ff' }, itemStyle: { color: '#3978ff', borderColor:'#0d1321', borderWidth:2 }, areaStyle: { color: 'rgba(57,120,255,.16)' } }] }
  const chartKey=`${valueFormat}-${data.map(point=>`${point.label}:${point.value}`).join('|')}`
  return <div className="chart-block"><div className="chart-modes" role="group" aria-label={lang === 'pt' ? 'Modo de comparação' : 'Comparison mode'}><button className={mode === 'value' ? 'active' : ''} onClick={() => setMode('value')}>{lang === 'pt' ? 'Valor' : 'Value'}</button><button className={mode === 'index' ? 'active' : ''} onClick={() => setMode('index')}>Index 100</button><button className={mode === 'change' ? 'active' : ''} onClick={() => setMode('change')}>{lang === 'pt' ? 'Variação %' : 'Change %'}</button></div><div className="chart-viewport"><ReactEChartsCore key={chartKey} echarts={echarts} option={option} notMerge={true} style={{height:300,width:'100%'}} /></div><div className="trend-readout"><article><span>{lang === 'pt' ? 'Nível mais recente' : 'Latest level'}</span><strong>{format(current)}</strong></article><article><span>{lang === 'pt' ? 'Amplitude observada' : 'Observed range'}</span><strong>{format(minimum)} <i>—</i> {format(maximum)}</strong></article><article><span>{lang === 'pt' ? 'Movimento no recorte' : 'Scope movement'}</span><strong className={movementTone}>{movement >= 0 ? '▲' : '▼'} {Math.abs(movement * 100).toFixed(1)}%</strong></article></div></div>
}

export function BarChart({ data, lang, onSelect, direction = 'neutral' }: { data: BreakdownRow[]; lang: Lang; onSelect?: (name: string) => void; direction?: Direction }) {
  const [mode, setMode] = useState<'value'|'share'>('value')
  const sorted = [...data].sort((a,b) => a.value - b.value).slice(-8)
  const total = data.reduce((sum, row) => sum + row.value, 0) || 1
  const previousTotal = data.reduce((sum, row) => sum + (row.previous??0), 0) || 1
  const compact = (value: number) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  const display = (value: number) => mode === 'share' ? `${value.toFixed(1)}%` : compact(value)
  type LabelPoint={data:{value:number;previous:number;delta:number;hasPrevious?:boolean;isNew?:boolean}}
  const seriesData=sorted.map(row=>{const value=mode==='share'?row.value/total*100:row.value,hasPrevious=row.previous!==undefined,previous=mode==='share'?(row.previous??0)/previousTotal*100:(row.previous??0),delta=previous?100*(value-previous)/Math.abs(previous):0;return{value,previous,delta,hasPrevious,isNew:hasPrevious&&previous===0}})
  const tone=(delta:number)=>direction==='neutral'||delta===0?'info':(direction==='up'?delta>0:delta<0)?'good':'bad'
  const comparison=(p:LabelPoint,rich=false)=>!p.data.hasPrevious?(rich?`{neutral|${lang==='pt'?'sem anterior':'no prior'}}`:(lang==='pt'?'sem anterior':'no prior')):p.data.isNew?(rich?`{new|${lang==='pt'?'nova':'new'}}`:(lang==='pt'?'nova':'new')):rich?`{${tone(p.data.delta)}|${p.data.delta>=0?'▲':'▼'} ${Math.abs(p.data.delta).toFixed(1)}%}`:`${p.data.delta>=0?'▲':'▼'} ${Math.abs(p.data.delta).toFixed(1)}%`,label=(p:LabelPoint)=>`{value|${display(p.data.value)}} {divider||} ${comparison(p,true)}`
  const priorSeries={name:lang==='pt'?'Período anterior':'Prior period',type:'bar',data:seriesData.map(row=>row.hasPrevious?row.previous:null),barWidth:18,itemStyle:{color:'rgba(145,160,188,.10)',borderColor:'#596780',borderWidth:1,borderRadius:[0,5,5,0]},silent:true,tooltip:{show:false},z:1}
  const currentSeries={name:lang==='pt'?'Período atual':'Current period',type:'bar',data:seriesData,barWidth:10,barGap:'-78%',itemStyle:{color:'#3978ff',borderRadius:[0,5,5,0]},emphasis:{disabled:true},z:2,label:{show:true,position:'right',formatter:label,rich:{value:{color:'#d8dfef'},divider:{color:'#596780'},good:{color:'#48d69f',fontWeight:700},bad:{color:'#ff617d',fontWeight:700},info:{color:'#6da0ff',fontWeight:700},new:{color:'#6da0ff',fontWeight:700},neutral:{color:'#91a0bc'}}}}
  const option = { animationDuration: 450, grid: { left: 12, right: 112, top: 12, bottom: 12, containLabel: true }, tooltip: { trigger: 'item', backgroundColor:'#171f32',borderColor:'#2b3853',textStyle:{color:'#f7f9ff'},formatter:(p:{name:string}&LabelPoint)=>`${p.name}<br/>${display(p.data.value)} | ${comparison(p)}` }, xAxis: { type: 'value', splitNumber: 3, max: mode === 'share' ? 100 : undefined, splitLine: { lineStyle: { color: '#202a3e' } }, axisLabel: { color: '#91a0bc', fontSize:10, hideOverlap:true, formatter: display } }, yAxis: { type: 'category', data: sorted.map(d => d.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#d8dfef', width: 120, overflow: 'truncate' } }, series:[priorSeries,currentSeries] }
  const events = onSelect ? { click: (params: { name: string }) => onSelect(params.name) } : undefined
  return <div className="chart-block"><div className="chart-modes" role="group" aria-label={lang === 'pt' ? 'Modo de comparação' : 'Comparison mode'}><small className="comparison-key">{lang==='pt'?'Cheio: atual · contorno: anterior':'Filled: current · outline: prior'}</small><button className={mode === 'value' ? 'active' : ''} onClick={() => setMode('value')}>{lang === 'pt' ? 'Valor' : 'Value'}</button><button className={mode === 'share' ? 'active' : ''} onClick={() => setMode('share')}>{lang === 'pt' ? 'Participação' : 'Share'}</button></div><div className="chart-viewport"><ReactEChartsCore echarts={echarts} option={option} onEvents={events} notMerge={true} style={{height:300,width:'100%'}} /></div></div>
}

export function DataGrid({ rows, pageId }: { rows: Record<string, string | number>[]; pageId: string }) {
  const columns = useMemo(() => Object.keys(rows[0] ?? {}).map(key => ({ accessorKey: key, header: key.replaceAll('_', ' ') })), [rows])
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const renderCell = (key: string, value: unknown) => {
    const text = String(value ?? '')
    const numeric = typeof value === 'number' ? value : Number(text)
    if (key.includes('pct') && Number.isFinite(numeric)) {
      const evaluative = key.includes('timely')
      const tone = evaluative ? (numeric >= 98 ? 'good' : 'attention') : 'info'
      return <span className={`status-chip ${tone}`}>{numeric.toFixed(1)}%</span>
    }
    if (key === 'status') return <span className={`status-chip ${text === 'Passed' ? 'good' : text === 'Failed' ? 'attention' : 'info'}`}>{text}</span>
    if (typeof value === 'number') return <b className="numeric-cell">{new Intl.NumberFormat('en-US', { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)}</b>
    return <span className={key === Object.keys(rows[0] ?? {})[0] ? 'primary-cell' : ''}>{text}</span>
  }
  return <div className="table-wrap" data-page={pageId}><table><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(h => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.slice(0, 10).map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{renderCell(cell.column.id, cell.getValue())}</td>)}</tr>)}</tbody></table></div>
}

export function DecisionNote({ title, children, action = false }: { title: string; children: React.ReactNode; action?: boolean }) {
  return <div className={`decision-note ${action ? 'action' : ''}`}><span>{title}</span><p>{children}</p>{action && <MoveRight size={18} />}</div>
}
