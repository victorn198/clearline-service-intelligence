import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, ExternalLink, FlaskConical, Play, RotateCcw, Square } from 'lucide-react'
import type { Lang } from './types'
import { aggregate, baseline, correct, EMPTY_FILTERS, evidence, exportCSV, exportRecords, filterRows, MODEL, sessionKey, TAXONOMY, undo,
  type Dataset, type Filters, type Label, type ReviewState, type SemanticResult, type Topic } from './semantic/core'
import { emptyState, readSession } from './semantic/session'
import './semantic/lab.css'

type Run = { phase: 'idle' | 'download' | 'inference' | 'complete' | 'cancelled' | 'error'; mode?: 'sample' | 'sandbox'; done: number; total: number; file?: string; percent?: number; error?: string }
type WorkerMessage = { type: 'download'; progress: { file?: string; progress?: number } }
  | { type: 'inference' | 'complete' } | { type: 'result'; id: string; result: SemanticResult; done: number }
  | { type: 'error'; message: string }

export default function SemanticLab({ lang }: { lang: Lang }) {
  const tr = (en: string, pt: string) => lang === 'pt' ? pt : en
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [state, setState] = useState<ReviewState>(emptyState)
  const [storageWarning, setStorageWarning] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState('')
  const [correction, setCorrection] = useState<Topic | ''>('')
  const [page, setPage] = useState(0)
  const [run, setRun] = useState<Run>({ phase: 'idle', done: 0, total: 0 })
  const workerRef = useRef<Worker | null>(null)
  const [reload, setReload] = useState(0)
  const [visitorText, setVisitorText] = useState('')
  const [visitorResult, setVisitorResult] = useState<SemanticResult | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    fetch(`${import.meta.env.BASE_URL}data/narrative-lab.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Dataset unavailable'); return r.json() as Promise<Dataset> })
      .then(data => {
        if (!data.meta?.version || data.rows?.length !== data.meta.sampleSize || !data.rows.every(row => row.id && row.narrative)) throw new Error('Invalid dataset')
        let saved = emptyState()
        try { saved = readSession(sessionStorage, data.meta.version, data.rows) } catch { setStorageWarning(true) }
        setState(saved); setDataset(data)
      }).catch(error => { if (error.name !== 'AbortError') setLoadError(true) })
    return () => controller.abort()
  }, [reload])
  useEffect(() => { if (dataset) { try { sessionStorage.setItem(sessionKey(dataset.meta.version), JSON.stringify(state)); setStorageWarning(false) } catch { setStorageWarning(true) } } }, [state, dataset])
  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null }, [])
  const allRows = useMemo(() => evidence(dataset?.rows ?? [], state), [dataset, state])
  const rows = useMemo(() => filterRows(allRows, filters), [allRows, filters])
  const stats = useMemo(() => aggregate(rows), [rows])
  const active = rows.find(r => r.id === selectedId) ?? rows[0]
  const activeId = active?.id
  useEffect(() => { setCorrection('') }, [activeId])
  const busy = run.phase === 'download' || run.phase === 'inference'
  const label = (id: Label) => id === 'uncertain' ? tr('Uncertain · review', 'Incerto · revisar') : TAXONOMY.find(t => t.id === id)![lang]
  const method = (value: string) => value === 'human_override' ? tr('Human correction', 'Correção humana') : value === 'semantic_similarity' ? tr('Semantic similarity', 'Similaridade semântica') : tr('Keyword rules', 'Regras por palavras-chave')
  const setFilter = (key: keyof Filters, value: string) => { setFilters(f => ({ ...f, [key]: value })); setPage(0) }
  const pageSize = 15, lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1), visiblePage = Math.min(page, lastPage)
  const start = (mode: 'sample' | 'sandbox' = 'sample') => {
    if (!dataset || workerRef.current) return
    // Classify the whole sample independently of view filters; exports always use filtered rows.
    const pending = mode === 'sandbox'
      ? (visitorText.trim() ? [{ id: 'visitor-input', narrative: visitorText.trim().slice(0, 2000) }] : [])
      : dataset.rows.filter(row => !state.results[row.id]).map(({ id, narrative }) => ({ id, narrative }))
    if (!pending.length) return
    if (mode === 'sandbox') setVisitorResult(null)
    setRun({ phase: 'download', mode, done: 0, total: pending.length })
    try {
      const worker = new Worker(new URL('./semantic/semantic.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      const fail = (message: string) => { setRun(r => ({ ...r, phase: 'error', error: message })); worker.terminate(); workerRef.current = null }
      worker.onerror = event => fail(event.message || 'Worker failed')
      worker.onmessageerror = () => fail('Worker message could not be read')
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data
        if (message.type === 'download') setRun(r => ({ ...r, file: message.progress.file ?? r.file, percent: message.progress.progress }))
        if (message.type === 'inference') setRun(r => ({ ...r, phase: 'inference', file: undefined, percent: undefined }))
        if (message.type === 'result') {
          if (mode === 'sandbox') setVisitorResult(message.result)
          else setState(s => ({ ...s, results: { ...s.results, [message.id]: message.result } }))
          setRun(r => ({ ...r, done: message.done }))
        }
        if (message.type === 'complete') { setRun(r => ({ ...r, phase: 'complete' })); worker.terminate(); workerRef.current = null }
        if (message.type === 'error') fail(message.message)
      }
      worker.postMessage({ rows: pending })
    } catch (error) {
      workerRef.current?.terminate(); workerRef.current = null
      setRun(r => ({ ...r, phase: 'error', error: error instanceof Error ? error.message : String(error) }))
    }
  }
  const cancel = () => { workerRef.current?.terminate(); workerRef.current = null; setRun(r => ({ ...r, phase: 'cancelled' })) }
  const download = (format: 'csv' | 'json') => {
    if (!dataset || !rows.length) return
    const payload = format === 'csv' ? exportCSV(rows, dataset.meta.version) : JSON.stringify({
      dataset: dataset.meta, model: MODEL, filters, rowCount: rows.length,
      note: 'Public CFPB narratives. Cosine similarity is not probability. Sample is not representative.',
      rows: exportRecords(rows, dataset.meta.version),
    }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `clearline-lab-${dataset.meta.version}-${rows.length}.${format}`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (loadError) return <section className="semantic-lab panel"><p role="alert">{tr('The narrative sample could not be loaded.', 'Não foi possível carregar a amostra de relatos.')}</p><button onClick={() => setReload(r => r + 1)}>{tr('Try again', 'Tentar novamente')}</button></section>
  if (!dataset) return <div className="loading" role="status">{tr('Loading public narratives…', 'Carregando relatos públicos…')}</div>
  const status = {
    idle: tr('Model has not run in this visit. Saved session results, if any, appear below.', 'O modelo ainda não rodou nesta visita. Resultados salvos na sessão, se houver, aparecem abaixo.'),
    download: tr('Downloading / loading model. First use can take a few minutes.', 'Baixando / carregando modelo. O primeiro uso pode levar alguns minutos.'),
    inference: tr('Computing local embeddings…', 'Calculando embeddings localmente…'),
    complete: tr('Analysis complete.', 'Análise concluída.'),
    cancelled: run.mode === 'sandbox' ? tr('Visitor analysis cancelled. Pasted text is not saved.', 'Análise do visitante cancelada. O texto colado não é salvo.') : tr('Cancelled. Completed rows were retained; resume analyses the remaining rows.', 'Cancelado. Registros concluídos foram mantidos; retomar analisa os restantes.'),
    error: tr('Model failed to load or run. Completed rows and keyword baseline remain available. Retry or check model / WASM network access.', 'Falha ao carregar ou executar o modelo. Registros concluídos e baseline continuam disponíveis. Tente novamente ou verifique acesso ao modelo / WASM.'),
  }[run.phase]
  return <div className="semantic-lab">
    <section className="report-summary">
      <div className="report-summary-head"><div><span>Clearline 2.0 · {tr('Semantic narrative laboratory', 'Laboratório semântico de relatos')}</span><h1>{tr('From narrative to reviewable evidence', 'Do relato à evidência revisável')}</h1><p>{tr('Compare keyword rules, computed semantic similarity and human corrections.', 'Compare regras por palavras-chave, similaridade semântica calculada e correções humanas.')}</p></div><FlaskConical size={30} aria-hidden="true" /></div>
      <div className="lab-contract"><p>{tr('200 real public CFPB narratives, in their original English. The sample balances products and timely-response strata to expose exceptions; it is not representative. Laboratory filters are independent of the dashboard.', '200 relatos públicos reais do CFPB, no inglês original. A amostra equilibra produtos e estratos de prazo para expor exceções; não é representativa. Os filtros do laboratório são independentes do painel.')}</p><p>{dataset.meta.period.min} — {dataset.meta.period.max} · {dataset.meta.eligibleNarratives.toLocaleString()} {tr('eligible narratives in source export', 'relatos elegíveis no export de origem')}</p></div>
    </section>
    <section className="panel lab-model" aria-label={tr('Model analysis', 'Análise com modelo')}>
      <div className="lab-actions"><button className="lab-primary" disabled={busy || allRows.every(r => r.semantic)} onClick={() => start('sample')}><Play size={16}/>{tr('Analyse with model', 'Analisar com modelo')}</button><button disabled={!busy} onClick={cancel}><Square size={15}/>{tr('Cancel', 'Cancelar')}</button><button disabled={busy || !Object.keys(state.results).length && !Object.keys(state.overrides).length} onClick={() => { setState(emptyState()); setRun({ phase: 'idle', done: 0, total: 0 }) }}><RotateCcw size={15}/>{tr('Reset session', 'Limpar sessão')}</button></div>
      <p>{tr('Inference runs inside a browser worker using MiniLM q8 / WASM. Clicking analyse downloads the model; no narrative text is sent to a remote service. No backend or paid API is required.', 'A inferência roda em um worker do navegador com MiniLM q8 / WASM. O clique em analisar baixa o modelo; nenhum relato é enviado a serviço remoto. Não exige backend nem API paga.')}</p>
      <div role="status" aria-live="polite"><b>{status}</b>{busy && <span> {run.done} / {run.total}</span>}{busy && run.file && <small> · {run.file}{typeof run.percent === 'number' ? ` · ${Math.round(run.percent)}%` : ''}</small>}</div>
      {busy && <progress aria-label={tr('Analysis progress', 'Progresso da análise')} max={run.total} value={run.phase === 'inference' ? run.done : undefined}/>}
      {run.error && <p role="alert" className="lab-warning">{run.error}</p>}
      {storageWarning && <p role="alert" className="lab-warning">{tr('Session storage is unavailable. Changes remain in this view only; export before leaving.', 'O armazenamento da sessão está indisponível. As alterações ficam apenas nesta tela; exporte antes de sair.')}</p>}
      <details><summary>{tr('Method, privacy and reproducibility', 'Método, privacidade e reprodutibilidade')}</summary>
        <p>{MODEL.id} · {MODEL.runtime} · q8 · WASM · {tr('revision', 'revisão')} <code>{MODEL.revision}</code></p>
        <p>{tr('Mean-pooled, normalized embeddings; cosine similarity to two English prototypes per category, taking the highest match. Only the leading 256 WordPiece tokens of each original narrative are embedded. Longer narratives may lose decisive context. Similarity is not probability or validated accuracy.', 'Embeddings normalizados com pooling médio; similaridade cosseno com dois protótipos em inglês por categoria, usando a maior correspondência. Apenas os primeiros 256 tokens WordPiece de cada relato original entram no modelo. Relatos longos podem perder contexto decisivo. Similaridade não é probabilidade nem acurácia validada.')}</p>
        <p>{tr('Uncertain if top cosine < 0.30 or lead over second category < 0.035. These are heuristic review thresholds, not calibrated confidence. Consumer statements are not verified findings. Human corrections change current categories without retraining the model. Inspired by semantic columns; no TADA runtime integration.', 'Incerto se o maior cosseno < 0,30 ou a margem sobre a segunda categoria < 0,035. São limiares heurísticos de revisão, não confiança calibrada. Relatos de consumidores não são conclusões verificadas. Correções mudam a categoria atual sem retreinar o modelo. Inspirado em colunas semânticas; sem integração com runtime TADA.')}</p>
        <p>{tr('The worker only downloads public model/tokenizer/configuration and WASM assets. Text is processed locally. Results and corrections use sessionStorage, scoped to this dataset, model revision, runtime and taxonomy. They survive page navigation and reloads in this tab; closing the tab ends the session. Browser-managed model asset cache is separate.', 'O worker apenas baixa arquivos públicos de modelo/tokenizador/configuração e WASM. O texto é processado localmente. Resultados e correções usam sessionStorage, por dataset, revisão do modelo, runtime e taxonomia. Sobrevivem à navegação e recargas nesta aba; fechar a aba encerra a sessão. O cache de arquivos do modelo é separado e gerenciado pelo navegador.')}</p>
        <p><a href="https://huggingface.co/Xenova/all-MiniLM-L6-v2" target="_blank" rel="noreferrer">{tr('Official model card', 'Ficha oficial do modelo')}</a> · <a href="https://huggingface.co/docs/transformers.js/v3.8.1/en/pipelines" target="_blank" rel="noreferrer">Transformers.js 3.8.1</a> · Apache-2.0</p>
        <p>{tr('Dataset version', 'Versão do dataset')}: <code>{dataset.meta.version}</code><br/>SHA256 {tr('original CSV', 'do CSV original')}: <code>{dataset.meta.sourceSha256}</code></p>
        <p>{dataset.meta.selection}</p>
        {TAXONOMY.map(t => <div key={t.id} className="lab-prototypes"><b>{t[lang]}</b>{t.prototypes.map(p => <p key={p}>{p}</p>)}</div>)}
      </details>
    </section>
    <section className="lab-filters panel" aria-label={tr('Laboratory filters', 'Filtros do laboratório')}>
      <label>{tr('Current category', 'Categoria atual')}<select value={filters.category} onChange={e => setFilter('category', e.target.value)}><option value="">{tr('All categories', 'Todas as categorias')}</option>{[...TAXONOMY.map(t => t.id), 'uncertain' as const].map(id => <option value={id} key={id}>{label(id)}</option>)}</select></label>
      <label>{tr('Product', 'Produto')}<select value={filters.product} onChange={e => setFilter('product', e.target.value)}><option value="">{tr('All products', 'Todos os produtos')}</option>{[...new Set(dataset.rows.map(r => r.product))].sort().map(p => <option key={p}>{p}</option>)}</select></label>
      <label>{tr('Operational / review flag', 'Sinal operacional / de revisão')}<select value={filters.flag} onChange={e => setFilter('flag', e.target.value)}><option value="">{tr('All records', 'Todos os registros')}</option>{[
        ['untimely', tr('Untimely response', 'Resposta fora do prazo')], ['relief', tr('Monetary relief indicator', 'Indicador de compensação monetária')],
        ['disagreement', tr('Baseline / model disagree', 'Divergência baseline / modelo')], ['uncertain', tr('Uncertain model result', 'Resultado incerto do modelo')],
        ['review', tr('Needs review', 'Revisão pendente')], ['corrected', tr('Human correction', 'Correção humana')], ['pending', tr('Model not run', 'Modelo não executado')],
      ].map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
      <label>{tr('Search ID, text, company or issue', 'Buscar ID, texto, empresa ou problema')}<input type="search" value={filters.query} onChange={e => setFilter('query', e.target.value)}/></label>
      <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(0) }}>{tr('Reset filters', 'Limpar filtros')}</button>
    </section>
    <section className="lab-stats" aria-label={tr('Filtered evidence', 'Evidência filtrada')}>
      {[[stats.total, tr('Filtered narratives', 'Relatos no recorte')], [stats.computed, tr('Model computed', 'Calculados pelo modelo')], [stats.disagreement, tr('Baseline / model disagree', 'Divergências baseline / modelo')], [stats.uncertain, tr('Uncertain results', 'Resultados incertos')], [stats.corrected, tr('Human corrections', 'Correções humanas')]].map(([n, name]) => <article key={name}><strong>{n}</strong><span>{name}</span></article>)}
    </section>
    <section className="panel lab-comparison"><h2>{tr('Three distinct classification layers', 'Três camadas distintas de classificação')}</h2><p>{tr('Counts below use the current filters. Semantic counts include only computed rows; pending rows are never counted as model results. Current categories prefer human corrections, then model results, then baseline rules.', 'As contagens usam os filtros atuais. Contagens semânticas incluem apenas registros calculados; pendências nunca contam como resultado do modelo. A categoria atual prioriza correção humana, resultado do modelo e depois baseline.')}</p>
      <div className="lab-table-wrap"><table><thead><tr><th>{tr('Category', 'Categoria')}</th><th>{tr('Keyword baseline', 'Baseline por palavras-chave')}</th><th>{tr('Computed semantic', 'Semântico calculado')}</th><th>{tr('Current', 'Atual')}</th></tr></thead><tbody>{stats.categories.map(c => <tr key={c.label}><th><button className="lab-text-button" onClick={() => setFilter('category', c.label)}>{label(c.label)}</button></th><td>{c.baseline}</td><td>{stats.computed ? c.semantic : '—'}</td><td>{c.current}</td></tr>)}</tbody></table></div>
      <p>{tr('Response in time', 'Resposta no prazo')}: <b>{stats.timelyRate === null ? '—' : `${(stats.timelyRate * 100).toFixed(1)}%`}</b> · {tr('Untimely', 'Fora do prazo')}: <b>{stats.untimely}</b> · {tr('Monetary relief share', 'Parcela com compensação monetária')}: <b>{stats.reliefRate === null ? '—' : `${(stats.reliefRate * 100).toFixed(1)}%`}</b></p>
      <p>{tr('These are source response flags within this selected sample. CFPB does not provide actual resolution duration or refund amounts.', 'São indicadores de resposta da fonte nesta amostra selecionada. O CFPB não fornece duração real de resolução nem valores de reembolso.')}</p>
    </section>
    <section className="panel lab-records"><div className="lab-section-head"><div><h2>{tr('Review queue', 'Fila de revisão')}</h2><p>{rows.length} / {dataset.rows.length} · {tr('export includes every filtered row, across all pages', 'a exportação inclui todos os registros filtrados, de todas as páginas')}</p></div><div className="lab-actions"><button disabled={!rows.length} onClick={() => download('csv')}><Download size={15}/>CSV · {rows.length}</button><button disabled={!rows.length} onClick={() => download('json')}><Download size={15}/>JSON · {rows.length}</button></div></div>
      <div className="lab-table-wrap"><table><thead><tr><th>ID · {tr('Product', 'Produto')}</th><th>{tr('Keyword baseline', 'Baseline por palavras-chave')}</th><th>{tr('Computed semantic', 'Semântico calculado')}</th><th>{tr('Cosine / margin', 'Cosseno / margem')}</th><th>{tr('Current / method', 'Atual / método')}</th><th>{tr('Source flags', 'Indicadores da fonte')}</th></tr></thead><tbody>{rows.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize).map(row => <tr key={row.id} className={active?.id === row.id ? 'lab-selected' : ''}><td><button className="lab-text-button" aria-pressed={active?.id === row.id} onClick={() => { setSelectedId(row.id); setCorrection('') }}>{row.id}</button><small>{row.receivedAt.slice(0, 10)} · {row.product}</small></td><td>{label(row.baselineLabel)}</td><td>{row.semantic ? label(row.semantic.label) : tr('Not run', 'Não executado')}</td><td>{row.semantic ? `${row.semantic.similarity.toFixed(3)} / ${row.semantic.margin.toFixed(3)}` : '—'}</td><td>{label(row.effectiveLabel)}<small>{method(row.effectiveMethod)}</small></td><td>{row.timely === null ? tr('Timely unknown', 'Prazo desconhecido') : row.timely ? tr('Timely: yes', 'No prazo: sim') : tr('Timely: no', 'No prazo: não')}<small>{tr('Monetary relief', 'Compensação monetária')}: {row.monetaryRelief ? tr('yes', 'sim') : tr('no', 'não')}</small></td></tr>)}</tbody></table></div>
      {!rows.length && <p role="status">{tr('No narratives match these filters.', 'Nenhum relato corresponde a estes filtros.')}</p>}
      <div className="lab-pagination"><button disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>{tr('Previous', 'Anterior')}</button><span>{visiblePage + 1} / {lastPage + 1}</span><button disabled={visiblePage === lastPage} onClick={() => setPage(visiblePage + 1)}>{tr('Next', 'Próxima')}</button></div>
    </section>
    {active && <section className="panel lab-evidence" aria-label={tr('Original narrative and human review', 'Relato original e revisão humana')}><div className="lab-section-head"><h2>{tr('Original evidence', 'Evidência original')} · {active.id}</h2><a href={active.sourceUrl} target="_blank" rel="noreferrer">{tr('Open CFPB record', 'Abrir registro CFPB')}<ExternalLink size={14}/></a></div>
      <p>{active.company} · {active.product} · {active.issue} · {active.state}</p><p>{tr('Received', 'Recebido')}: {active.receivedAt} · {tr('Sent to company', 'Enviado à empresa')}: {active.sentAt}</p>
      <blockquote lang="en">{active.narrative}</blockquote>
      {active.semantic && <div><b>{tr('Computed similarities (not probabilities)', 'Similaridades calculadas (não probabilidades)')}</b><ul>{active.semantic.scores.map(s => <li key={s.label}>{label(s.label)}: {s.score.toFixed(3)}</li>)}</ul>{active.semantic.label === 'uncertain' && <p className="lab-warning">{tr('Review required. Closest prototype', 'Revisão necessária. Protótipo mais próximo')}: {label(active.semantic.topLabel)}</p>}</div>}
      <div className="lab-review"><label>{tr('Human correction', 'Correção humana')}<select value={correction} onChange={e => setCorrection(e.target.value as Topic | '')}><option value="">{tr('Choose reviewed category', 'Escolha a categoria revisada')}</option>{TAXONOMY.map(t => <option key={t.id} value={t.id}>{t[lang]}</option>)}</select></label><button disabled={!correction} className="lab-primary" onClick={() => { if (correction) { setState(s => correct(s, active.id, correction)); setCorrection('') } }}>{tr('Apply correction', 'Aplicar correção')}</button><button disabled={!active.override} onClick={() => setState(s => undo(s, active.id))}><RotateCcw size={14}/>{tr('Undo correction', 'Desfazer correção')}</button></div>
      {active.override && <p role="status">{tr('Human correction applied', 'Correção humana aplicada')}: {label(active.override.label)} · {active.override.at}</p>}
    </section>}
    <section className="panel lab-sandbox" aria-label={tr('Visitor text sandbox', 'Área de texto do visitante')}>
      <h2>{tr('Try your own English text', 'Experimente seu texto em inglês')}</h2>
      <p>{tr('Separate visitor sandbox — this text is not CFPB evidence and never enters the sample counts, review state or exports. Use English: the model and category prototypes are English. Text stays in this view and is not saved to session storage or sent remotely.', 'Área separada do visitante — este texto não é evidência CFPB e nunca entra nas contagens, revisões ou exportações da amostra. Use inglês: o modelo e os protótipos estão em inglês. O texto fica nesta tela e não é salvo na sessão nem enviado remotamente.')}</p>
      <label>{tr('English narrative · maximum 2,000 characters', 'Relato em inglês · máximo de 2.000 caracteres')}<textarea maxLength={2000} rows={5} disabled={busy} value={visitorText} onChange={e => { setVisitorText(e.target.value.slice(0, 2000)); setVisitorResult(null) }}/></label>
      <p>{visitorText.length} / 2000 · {tr('Only the leading 256 WordPiece tokens are embedded, using the same pinned model, prototypes and uncertainty thresholds.', 'Apenas os primeiros 256 tokens WordPiece entram no modelo, usando a mesma revisão, protótipos e limiares de incerteza.')}</p>
      <div className="lab-actions"><button className="lab-primary" disabled={busy || !visitorText.trim()} onClick={() => start('sandbox')}><Play size={15}/>{tr('Analyse pasted text locally', 'Analisar texto colado localmente')}</button><button disabled={!busy || run.mode !== 'sandbox'} onClick={cancel}>{tr('Cancel visitor analysis', 'Cancelar análise do visitante')}</button><button disabled={busy || !visitorText} onClick={() => { setVisitorText(''); setVisitorResult(null) }}>{tr('Clear pasted text', 'Limpar texto colado')}</button></div>
      {run.mode === 'sandbox' && <p role="status">{status} {busy && `${run.done} / ${run.total}`}</p>}
      {visitorText.trim() && <p>{tr('Visitor keyword baseline', 'Baseline do visitante por palavras-chave')}: <b>{label(baseline(visitorText))}</b></p>}
      {visitorResult && <div className="lab-visitor-result"><h3>{tr('Visitor semantic result', 'Resultado semântico do visitante')}: {label(visitorResult.label)}</h3><p>{tr('Cosine similarity (not probability)', 'Similaridade cosseno (não probabilidade)')}: {visitorResult.similarity.toFixed(3)} · {tr('Margin', 'Margem')}: {visitorResult.margin.toFixed(3)}</p>{visitorResult.label === 'uncertain' && <p className="lab-warning">{tr('Closest prototype; human review required', 'Protótipo mais próximo; revisão humana necessária')}: {label(visitorResult.topLabel)}</p>}<ul>{visitorResult.scores.map(s => <li key={s.label}>{label(s.label)}: {s.score.toFixed(3)}</li>)}</ul></div>}
    </section>
  </div>
}
