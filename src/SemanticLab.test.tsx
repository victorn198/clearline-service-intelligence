// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SemanticLab from './SemanticLab'
import { MODEL, sessionKey, TAXONOMY, type SemanticResult } from './semantic/core'

// Explicit synthetic UI fixtures. No test double is shipped to the application.
const records = Array.from({ length: 18 }, (_, i) => ({ id: `SYNTHETIC-${i}`, receivedAt: '2025-01-01', sentAt: '2025-01-02', product: i < 16 ? 'Card' : 'Loan', issue: 'Synthetic issue', company: 'Synthetic company', state: 'CA', timely: i !== 0, monetaryRelief: i === 0, companyResponse: 'Closed with explanation', narrative: `Synthetic narrative ${i}: a payment is missing.`, baseline: 'Payments & fees', sourceUrl: `https://example.org/synthetic/${i}` }))
const data = { meta: { version: 'synthetic-ui-v1', sampleSize: records.length, source: 'SYNTHETIC UI fixture', sourceUrl: 'https://example.org', sourceSha256: 'test', eligibleNarratives: records.length, selection: 'SYNTHETIC test only', period: { min: '2025-01-01', max: '2025-01-02' } }, rows: records }
const computed: SemanticResult = { label: 'access', topLabel: 'access', similarity: .55, margin: .09, scores: TAXONOMY.map(t => ({ label: t.id, score: t.id === 'access' ? .55 : .1 })) }
class TestWorker {
  static instances: TestWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { TestWorker.instances.push(this) }
  emit(data: unknown) { this.onmessage?.({ data } as MessageEvent) }
}
let blob: Blob | undefined
let savedFilename = ''
beforeEach(() => {
  sessionStorage.clear(); TestWorker.instances = []; blob = undefined; savedFilename = ''
  vi.stubGlobal('Worker', TestWorker)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })))
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn((value: Blob) => { blob = value; return 'blob:synthetic' }); static revokeObjectURL = vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { savedFilename = this.download })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const loaded = () => screen.findByRole('button', { name: 'Analyse with model' })

describe('laboratory interactions without a browser or remote inference', () => {
  it('keeps baseline usable and creates no worker before an explicit analysis click', async () => {
    render(<SemanticLab lang="en"/>); await loaded()
    expect(TestWorker.instances).toHaveLength(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('data/narrative-lab.json')
    expect(screen.getAllByText('Not run')).toHaveLength(15)
    expect((screen.getByRole('button', { name: 'CSV · 18' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('sends the whole pending sample to a local worker, persists partial results, terminates on cancel, and resumes only remaining rows', async () => {
    const view = render(<SemanticLab lang="en"/>); fireEvent.click(await loaded())
    expect(TestWorker.instances).toHaveLength(1)
    const worker = TestWorker.instances[0]
    expect(worker.postMessage.mock.calls[0][0].rows).toHaveLength(18)
    act(() => { worker.emit({ type: 'inference' }); worker.emit({ type: 'result', id: records[0].id, result: computed, done: 1 }) })
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(sessionKey(data.meta.version))!).results[records[0].id]).toEqual(computed))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Cancelled\. Completed rows/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Analyse with model' }))
    expect(TestWorker.instances[1].postMessage.mock.calls[0][0].rows).toHaveLength(17)
    expect(TestWorker.instances[1].postMessage.mock.calls[0][0].rows.some((r: { id: string }) => r.id === records[0].id)).toBe(false)
    view.unmount(); expect(TestWorker.instances[1].terminate).toHaveBeenCalledTimes(1)
  })
  it('shows a model error while preserving baseline and completed evidence, and allows retry', async () => {
    render(<SemanticLab lang="en"/>); fireEvent.click(await loaded())
    act(() => TestWorker.instances[0].emit({ type: 'error', message: 'SYNTHETIC network error' }))
    expect(screen.getByRole('alert').textContent).toContain('SYNTHETIC network error')
    expect(screen.getAllByText('Not run')).toHaveLength(15)
    fireEvent.click(screen.getByRole('button', { name: 'Analyse with model' }))
    expect(TestWorker.instances).toHaveLength(2)
  })
  it('applies and undoes a human correction without replacing computed results, and restores it on remount', async () => {
    sessionStorage.setItem(sessionKey(data.meta.version), JSON.stringify({ results: { [records[0].id]: computed }, overrides: {} }))
    const view = render(<SemanticLab lang="en"/>); await loaded()
    const review = screen.getByRole('region', { name: 'Original narrative and human review' })
    fireEvent.change(within(review).getByLabelText('Human correction'), { target: { value: 'identity' } })
    fireEvent.click(within(review).getByRole('button', { name: 'Apply correction' }))
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(sessionKey(data.meta.version))!).overrides[records[0].id].label).toBe('identity'))
    expect(within(review).getByRole('status').textContent).toContain('Identity & fraud')
    view.unmount()
    render(<SemanticLab lang="pt"/>); await screen.findByRole('button', { name: 'Analisar com modelo' })
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer correção' }))
    const saved = JSON.parse(sessionStorage.getItem(sessionKey(data.meta.version))!)
    expect(saved.overrides).toEqual({}); expect(saved.results[records[0].id]).toEqual(computed)
    expect(TestWorker.instances).toHaveLength(0)
  })
  it('exports the current filter across pagination and reflects edits rather than exporting all source rows', async () => {
    render(<SemanticLab lang="en"/>); await loaded()
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'Card' } })
    fireEvent.click(screen.getByRole('button', { name: 'CSV · 16' }))
    expect(blob?.type).toBe('text/csv;charset=utf-8')
    expect(savedFilename).toContain('-16.csv')
    const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob!) })
    expect(text).toContain('SYNTHETIC-15') // second page must be included
    expect(text).not.toContain('SYNTHETIC-16')
    expect(text).toContain(MODEL.revision)
    fireEvent.change(screen.getByLabelText('Current category'), { target: { value: 'access' } })
    expect(screen.getByText('No narratives match these filters.')).toBeDefined()
    expect((screen.getByRole('button', { name: 'CSV · 0' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('exports JSON with actual filtered rows, filters and provenance and no invented model results', async () => {
    render(<SemanticLab lang="en"/>); await loaded()
    fireEvent.change(screen.getByLabelText('Operational / review flag'), { target: { value: 'untimely' } })
    fireEvent.click(screen.getByRole('button', { name: 'JSON · 1' }))
    const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob!) })
    const exported = JSON.parse(text)
    expect(exported.rowCount).toBe(1)
    expect(exported.filters.flag).toBe('untimely')
    expect(exported.rows[0]).toMatchObject({ complaint_id: 'SYNTHETIC-0', model_status: 'not_run', semantic_label: null, effective_method: 'keyword_rules' })
    expect(exported.model.revision).toBe(MODEL.revision)
  })
  it('runs pasted English text through the same local worker without entering CFPB counts, session state or exports', async () => {
    render(<SemanticLab lang="en"/>); await loaded()
    const sandbox = screen.getByRole('region', { name: 'Visitor text sandbox' })
    const text = 'Visitor-only example: the bank froze my savings.'
    fireEvent.change(within(sandbox).getByRole('textbox'), { target: { value: text } })
    expect(TestWorker.instances).toHaveLength(0)
    fireEvent.click(within(sandbox).getByRole('button', { name: 'Analyse pasted text locally' }))
    const worker = TestWorker.instances[0]
    expect(worker.postMessage.mock.calls[0][0].rows).toEqual([{ id: 'visitor-input', narrative: text }])
    act(() => { worker.emit({ type: 'result', id: 'visitor-input', result: computed, done: 1 }); worker.emit({ type: 'complete' }) })
    expect(within(sandbox).getByRole('heading', { name: 'Visitor semantic result: Account access' })).toBeDefined()
    expect(JSON.parse(sessionStorage.getItem(sessionKey(data.meta.version))!)).toEqual({ results: {}, overrides: {} })
    expect(sessionStorage.getItem(sessionKey(data.meta.version))).not.toContain(text)
    fireEvent.click(screen.getByRole('button', { name: 'JSON · 18' }))
    const exported = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob!) })
    expect(JSON.parse(exported).rowCount).toBe(18)
    expect(exported).not.toContain('visitor-input')
    expect(exported).not.toContain(text)
    fireEvent.click(within(sandbox).getByRole('button', { name: 'Clear pasted text' }))
    expect((within(sandbox).getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
    expect(within(sandbox).queryByRole('heading', { name: /Visitor semantic result/ })).toBeNull()
  })
  it('bounds visitor input and cancels it without changing sample review state', async () => {
    render(<SemanticLab lang="en"/>); await loaded()
    const sandbox = screen.getByRole('region', { name: 'Visitor text sandbox' })
    fireEvent.change(within(sandbox).getByRole('textbox'), { target: { value: 'A'.repeat(2400) } })
    expect((within(sandbox).getByRole('textbox') as HTMLTextAreaElement).value).toHaveLength(2000)
    fireEvent.click(within(sandbox).getByRole('button', { name: 'Analyse pasted text locally' }))
    expect(TestWorker.instances[0].postMessage.mock.calls[0][0].rows[0].narrative).toHaveLength(2000)
    fireEvent.click(within(sandbox).getByRole('button', { name: 'Cancel visitor analysis' }))
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledTimes(1)
    expect(within(sandbox).getByRole('status').textContent).toContain('Visitor analysis cancelled')
    expect(JSON.parse(sessionStorage.getItem(sessionKey(data.meta.version))!).results).toEqual({})
  })
})
