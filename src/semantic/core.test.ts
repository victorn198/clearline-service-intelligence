import { describe, expect, it } from 'vitest'
import { aggregate, baseline, classify, correct, cosine, EMPTY_FILTERS, evidence, exportCSV, exportRecords, filterRows, MODEL, sessionKey, TAXONOMY, undo, type Narrative, type ReviewState, type SemanticResult, type Topic } from './core'
import { emptyState, readSession } from './session'
import sample from '../../public/data/narrative-lab.json'

const fixture = (id: string, narrative: string, timely: boolean | null = true, monetaryRelief = false): Narrative => ({ id, narrative, timely, monetaryRelief, receivedAt: '2025-01-01', sentAt: '2025-01-02', product: id === 'b' ? 'Loan' : 'Card', issue: 'Test issue', company: 'Test company', state: 'CA', companyResponse: 'Closed with explanation', baseline: '', sourceUrl: `https://example.org/${id}` })
const result = (label: Topic | 'uncertain'): SemanticResult => ({ label, topLabel: label === 'uncertain' ? 'identity' : label, similarity: .6, margin: .1, scores: TAXONOMY.map(t => ({ label: t.id, score: t.id === label ? .6 : .3 })) })
const fixtures = [fixture('a', 'An unauthorized charge', false, true), fixture('b', 'A credit report error', true), fixture('c', 'My payment is missing', null)]
const state: ReviewState = { results: { a: result('payments'), b: result('uncertain') }, overrides: {} }

describe('semantic classification contracts', () => {
  it('matches the Python keyword priority and exported baseline for all 200 real rows', () => {
    expect(sample.rows).toHaveLength(200)
    for (const row of sample.rows) expect(TAXONOMY.find(t => t.id === baseline(row.narrative))?.en).toBe(row.baseline)
    for (const t of TAXONOMY) if (t.terms.length) expect([...t.terms]).toEqual((sample.meta.baselineRules as Record<string, string[]>)[t.en])
    expect(baseline('unauthorized fee and collection')).toBe('identity')
    expect(baseline('')).toBe('other')
  })
  it('uses actual cosine normalization, rejects invalid embeddings, and preserves negative similarity', () => {
    expect(cosine([2, 0], [10, 0])).toBe(1)
    expect(cosine([1, 0], [-1, 0])).toBe(-1)
    expect(cosine([1, 0], [0, 2])).toBe(0)
    expect(() => cosine([0, 0], [1, 1])).toThrow()
    expect(() => cosine([1], [1, 2])).toThrow()
    expect(() => cosine([NaN], [1])).toThrow()
  })
  it('classifies by the closest prototype and abstains on close or weak matches', () => {
    const prototypes = TAXONOMY.map((t, i) => ({ label: t.id, vector: [i === 0 ? 1 : 0, i === 0 ? 0 : 1] }))
    expect(classify([1, 0], prototypes).label).toBe('identity')
    expect(classify([1, 1], prototypes).label).toBe('uncertain')
    expect(classify([-1, -1], prototypes).label).toBe('uncertain')
    expect(classify([1, 1], prototypes).scores).toHaveLength(6)
    expect(() => classify([1, 0], prototypes.slice(1))).toThrow('Missing prototypes')
  })
  it('preserves each method independently, uses baseline until computed, and removes overrides without losing inference', () => {
    let edited = correct(state, 'a', 'access', '2026-10-31T12:00:00Z')
    const rows = evidence(fixtures, edited)
    expect(rows[0]).toMatchObject({ baselineLabel: 'identity', semantic: { label: 'payments' }, effectiveLabel: 'access', effectiveMethod: 'human_override', disagreement: true, needsReview: false })
    expect(rows[1]).toMatchObject({ effectiveLabel: 'uncertain', effectiveMethod: 'semantic_similarity', needsReview: true })
    expect(rows[2]).toMatchObject({ effectiveLabel: 'payments', effectiveMethod: 'keyword_rules' })
    edited = undo(edited, 'a')
    expect(evidence(fixtures, edited)[0]).toMatchObject({ effectiveLabel: 'payments', effectiveMethod: 'semantic_similarity', needsReview: true })
    expect(state.overrides).toEqual({})
    expect(() => correct(state, 'a', 'invalid' as Topic)).toThrow()
  })
  it('filters the effective category after overrides and combines actual product, source, review and text scopes', () => {
    const rows = evidence(fixtures, correct(state, 'a', 'access'))
    expect(filterRows(rows, { ...EMPTY_FILTERS, category: 'access', product: 'Card', flag: 'untimely', query: 'unauthorized' }).map(r => r.id)).toEqual(['a'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, category: 'identity' })).toEqual([])
    expect(filterRows(rows, { ...EMPTY_FILTERS, flag: 'uncertain' }).map(r => r.id)).toEqual(['b'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, flag: 'pending' }).map(r => r.id)).toEqual(['c'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, flag: 'corrected', product: 'Loan' })).toEqual([])
    expect(filterRows(rows, { ...EMPTY_FILTERS, flag: 'relief' }).map(r => r.id)).toEqual(['a'])
  })
  it('aggregates only filtered rows and never counts keyword fallback as computed semantics', () => {
    const rows = evidence(fixtures, state), stats = aggregate(rows)
    expect(stats).toMatchObject({ total: 3, computed: 2, corrected: 0, uncertain: 1, disagreement: 1, timelyRate: .5, reliefRate: 1 / 3, untimely: 1 })
    expect(stats.categories.reduce((n, c) => n + c.semantic, 0)).toBe(2)
    expect(stats.categories.reduce((n, c) => n + c.current, 0)).toBe(3)
    expect(aggregate(filterRows(rows, { ...EMPTY_FILTERS, product: 'Loan' }))).toMatchObject({ total: 1, computed: 1, timelyRate: 1, reliefRate: 0 })
    expect(aggregate([])).toMatchObject({ total: 0, timelyRate: null, reliefRate: null })
  })
  it('exports every supplied filtered row with source, revision and distinct methods, including pending/null results', () => {
    const rows = filterRows(evidence(fixtures, correct(state, 'a', 'access')), { ...EMPTY_FILTERS, product: 'Card' })
    const exported = exportRecords(rows, 'dataset-v1')
    expect(exported.map(r => r.complaint_id)).toEqual(['a', 'c'])
    expect(exported[0]).toMatchObject({ baseline_label: 'identity', semantic_label: 'payments', human_override: 'access', effective_method: 'human_override', semantic_method: 'semantic_similarity', model_revision: MODEL.revision, source_url: 'https://example.org/a' })
    expect(exported[1]).toMatchObject({ semantic_label: null, cosine_similarity: null, model_status: 'not_run', timely_response: null })
    expect(Object.keys(exported[0]).some(k => /duration|refund_amount|probability/.test(k))).toBe(false)
    expect(exportCSV([], 'dataset-v1')).toBe('')
  })
  it('escapes quotes and newlines in CSV and neutralizes spreadsheet formulas, preserving raw JSON evidence', () => {
    const text = '=HYPERLINK("bad")\nSecond line, with comma'
    const rows = evidence([fixture('csv', text)], emptyState())
    expect(exportCSV(rows, 'v1')).toContain('"\'=HYPERLINK(""bad"")\nSecond line, with comma"')
    expect(exportRecords(rows, 'v1')[0].narrative).toBe(text)
  })
})

describe('public source integrity and session isolation', () => {
  it('contains unique public source IDs, original source dates and a strict monetary relief flag', () => {
    expect(new Set(sample.rows.map(r => r.id)).size).toBe(200)
    expect(sample.meta.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    for (const row of sample.rows) {
      expect(row.id).toMatch(/^\d+$/)
      expect(row.sourceUrl).toBe(`https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/${row.id}`)
      expect(row.receivedAt.slice(0, 10) >= '2025-01-01' && row.receivedAt.slice(0, 10) <= '2025-01-07').toBe(true)
      expect(row.monetaryRelief).toBe(row.companyResponse === 'Closed with monetary relief')
    }
  })
  it('restores current-dataset results/overrides only and scopes the key to model/taxonomy/runtime', () => {
    const saved = correct(state, 'a', 'access')
    const storage = { getItem: (key: string) => key === sessionKey('v1') ? JSON.stringify(saved) : null }
    expect(readSession(storage, 'v1', fixtures)).toEqual(saved)
    expect(readSession(storage, 'v2', fixtures)).toEqual(emptyState())
    expect(readSession(storage, 'v1', [])).toEqual(emptyState())
    expect(sessionKey('v1')).toContain(MODEL.revision)
    expect(sessionKey('v1')).toContain(MODEL.taxonomyVersion)
    expect(sessionKey('v1')).toContain(MODEL.runtime)
  })
  it('ignores corrupt/unavailable session data and invalid categories, IDs, dates and scores', () => {
    expect(readSession({ getItem: () => '{broken' }, 'v1', fixtures)).toEqual(emptyState())
    expect(readSession({ getItem: () => { throw new Error('storage denied') } }, 'v1', fixtures)).toEqual(emptyState())
    const corrupt = { results: { a: { ...result('identity'), similarity: 50 }, unknown: result('identity') }, overrides: { a: { label: 'nonsense', at: 'today' }, b: { label: 'access', at: 'not a date' } } }
    expect(readSession({ getItem: () => JSON.stringify(corrupt) }, 'v1', fixtures)).toEqual(emptyState())
  })
})
