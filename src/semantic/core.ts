// Pure, shared browser / Node classification and evidence contracts.
export const MODEL = {
  id: 'Xenova/all-MiniLM-L6-v2', revision: '751bff37182d3f1213fa05d7196b954e230abad9',
  runtime: '@huggingface/transformers@3.8.1', dtype: 'q8', device: 'wasm',
  method: 'semantic_similarity', taxonomyVersion: 'clearline-topics-v1',
  minSimilarity: 0.30, minMargin: 0.035, maxTokens: 256,
} as const
export const TAXONOMY = [
  { id: 'identity', en: 'Identity & fraud', pt: 'Identidade e fraude', terms: ['identity', 'fraud', 'not mine', 'unauthorized'], prototypes: [
    'Identity theft and fraud. Someone used my personal information to open an account without my permission. This account is not mine.',
    'Unauthorized transactions. Someone stole my card details and made purchases that I did not authorize.',
  ] },
  { id: 'reporting', en: 'Credit reporting accuracy', pt: 'Precisão do relatório de crédito', terms: ['credit report', 'incorrect information', 'score'], prototypes: [
    'Credit reporting accuracy. My credit file contains incorrect balances, late payments, or inaccurate personal information. Please correct the credit bureau records.',
    'I disputed an error on my credit report. The bureau did not investigate or remove the inaccurate entry and my credit score was affected.',
  ] },
  { id: 'payments', en: 'Payments & fees', pt: 'Pagamentos e tarifas', terms: ['payment', 'fee', 'interest', 'charge'], prototypes: [
    'Payments, billing and fees. My payment was not applied to my balance. I was billed additional interest and unexpected fees.',
    'The bank charged an overdraft fee or processed a payment incorrectly. I need a billing adjustment or a refund for a duplicate charge.',
  ] },
  { id: 'collection', en: 'Debt collection', pt: 'Cobrança de dívidas', terms: ['collection', 'collector', 'debt'], prototypes: [
    'Debt collection. A collector repeatedly calls demanding repayment. They threaten legal action and will not provide verification of the debt.',
    'A collection agency is trying to collect a debt I dispute. I requested validation and asked them to stop contacting me.',
  ] },
  { id: 'access', en: 'Account access', pt: 'Acesso à conta', terms: ['close', 'cancel', 'access', 'blocked'], prototypes: [
    'Account access and closure. My bank froze my account and I cannot log in, withdraw my money or access my funds.',
    'The bank closed or restricted my account without explanation. I cannot get access restored or cancel the account.',
  ] },
  { id: 'other', en: 'Other service issues', pt: 'Outros problemas de atendimento', terms: [], prototypes: [
    'Customer service and communication. Support staff do not answer my questions or explain their process, and I cannot reach someone who can help.',
    'My financial service application is delayed. The company gives confusing instructions and does not send requested documents or updates.',
  ] },
] as const
export type Topic = typeof TAXONOMY[number]['id']
export type Label = Topic | 'uncertain'
export type Narrative = {
  id: string; receivedAt: string; sentAt: string; product: string; issue: string;
  company: string; state: string; timely: boolean | null; companyResponse: string;
  monetaryRelief: boolean; narrative: string; baseline: string; sourceUrl: string;
}
export type Dataset = { meta: {
  version: string; sampleSize: number; source: string; sourceUrl: string; sourceSha256: string;
  eligibleNarratives: number; selection: string; period: { min: string; max: string };
}; rows: Narrative[] }
export type SemanticResult = { label: Label; topLabel: Topic; similarity: number; margin: number; scores: { label: Topic; score: number }[] }
export type Override = { label: Topic; at: string }
export type ReviewState = { results: Record<string, SemanticResult>; overrides: Record<string, Override> }
export type EvidenceRow = Narrative & {
  baselineLabel: Topic; semantic?: SemanticResult; override?: Override;
  effectiveLabel: Label; effectiveMethod: 'keyword_rules' | 'semantic_similarity' | 'human_override';
  disagreement: boolean; needsReview: boolean;
}
export type Filters = { category: string; product: string; flag: string; query: string }
export const EMPTY_FILTERS: Filters = { category: '', product: '', flag: '', query: '' }
export const isTopic = (value: unknown): value is Topic => TAXONOMY.some(t => t.id === value)
export function baseline(text: string): Topic {
  const normalized = text.toLowerCase()
  return TAXONOMY.find(t => t.terms.some(term => normalized.includes(term)))?.id ?? 'other'
}
export function cosine(a: readonly number[], b: readonly number[]): number {
  if (!a.length || a.length !== b.length || [...a, ...b].some(v => !Number.isFinite(v))) throw new Error('Invalid embedding vectors')
  let dot = 0, aa = 0, bb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2 }
  if (!aa || !bb) throw new Error('Empty embedding norm')
  return Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb)))
}
export function classify(vector: number[], prototypes: { label: Topic; vector: number[] }[]): SemanticResult {
  const scores = TAXONOMY.map(t => {
    const group = prototypes.filter(p => p.label === t.id)
    if (!group.length) throw new Error(`Missing prototypes: ${t.id}`)
    return { label: t.id, score: Math.max(...group.map(p => cosine(vector, p.vector))) }
  }).sort((a, b) => b.score - a.score)
  const similarity = scores[0].score, margin = similarity - scores[1].score
  return { label: similarity < MODEL.minSimilarity || margin < MODEL.minMargin ? 'uncertain' : scores[0].label,
    topLabel: scores[0].label, similarity, margin, scores }
}
export function evidence(rows: Narrative[], state: ReviewState): EvidenceRow[] {
  return rows.map(row => {
    const baselineLabel = baseline(row.narrative), semantic = state.results[row.id], override = state.overrides[row.id]
    const disagreement = !!semantic && semantic.label !== 'uncertain' && semantic.label !== baselineLabel
    return { ...row, baselineLabel, semantic, override,
      effectiveLabel: override?.label ?? semantic?.label ?? baselineLabel,
      effectiveMethod: override ? 'human_override' : semantic ? 'semantic_similarity' : 'keyword_rules',
      disagreement, needsReview: !override && (!semantic || semantic.label === 'uncertain' || disagreement),
    }
  })
}
export function filterRows(rows: EvidenceRow[], filters: Filters): EvidenceRow[] {
  const query = filters.query.trim().toLowerCase()
  return rows.filter(row => (!filters.category || row.effectiveLabel === filters.category)
    && (!filters.product || row.product === filters.product)
    && (!query || `${row.id} ${row.narrative} ${row.company} ${row.issue}`.toLowerCase().includes(query))
    && (!filters.flag || ({ untimely: row.timely === false, relief: row.monetaryRelief,
      disagreement: row.disagreement, uncertain: row.semantic?.label === 'uncertain',
      review: row.needsReview, corrected: !!row.override, pending: !row.semantic } as Record<string, boolean | undefined>)[filters.flag]))
}
export function aggregate(rows: EvidenceRow[]) {
  const computed = rows.filter(r => r.semantic), knownTimely = rows.filter(r => r.timely !== null)
  return { total: rows.length, computed: computed.length, corrected: rows.filter(r => r.override).length,
    uncertain: computed.filter(r => r.semantic?.label === 'uncertain').length,
    disagreement: computed.filter(r => r.disagreement).length, review: rows.filter(r => r.needsReview).length,
    timelyRate: knownTimely.length ? knownTimely.filter(r => r.timely).length / knownTimely.length : null,
    untimely: rows.filter(r => r.timely === false).length,
    reliefRate: rows.length ? rows.filter(r => r.monetaryRelief).length / rows.length : null,
    categories: [...TAXONOMY.map(t => t.id), 'uncertain' as const].map(label => ({ label,
      baseline: rows.filter(r => r.baselineLabel === label).length,
      semantic: computed.filter(r => r.semantic?.label === label).length,
      current: rows.filter(r => r.effectiveLabel === label).length,
    })),
  }
}
export function correct(state: ReviewState, id: string, label: Topic, at = new Date().toISOString()): ReviewState {
  if (!isTopic(label)) throw new Error('Unknown correction category')
  return { ...state, overrides: { ...state.overrides, [id]: { label, at } } }
}
export function undo(state: ReviewState, id: string): ReviewState {
  const overrides = { ...state.overrides }; delete overrides[id]
  return { ...state, overrides }
}
export function sessionKey(dataset: string) {
  return `clearline:semantic-lab:${dataset}:${MODEL.id}:${MODEL.revision}:${MODEL.runtime}:${MODEL.dtype}:${MODEL.taxonomyVersion}:${MODEL.minSimilarity}:${MODEL.minMargin}:${MODEL.maxTokens}`
}
export function exportRecords(rows: EvidenceRow[], dataset: string) {
  return rows.map(row => ({
    complaint_id: row.id, dataset_version: dataset, source: 'CFPB Consumer Complaint Database', source_url: row.sourceUrl,
    received_at: row.receivedAt, sent_to_company_at: row.sentAt, product: row.product, issue: row.issue,
    company: row.company, state: row.state, timely_response: row.timely, monetary_relief_indicator: row.monetaryRelief,
    company_response: row.companyResponse, narrative: row.narrative,
    baseline_label: row.baselineLabel, baseline_method: 'keyword_rules', baseline_version: 'pipeline/topics.py:v1',
    semantic_label: row.semantic?.label ?? null, semantic_method: row.semantic ? MODEL.method : null,
    semantic_top_label: row.semantic?.topLabel ?? null, cosine_similarity: row.semantic?.similarity ?? null,
    cosine_margin: row.semantic?.margin ?? null, semantic_scores: row.semantic ? JSON.stringify(row.semantic.scores) : null,
    model_id: MODEL.id, model_revision: MODEL.revision, runtime: MODEL.runtime, dtype: MODEL.dtype, device: MODEL.device,
    taxonomy_version: MODEL.taxonomyVersion, min_similarity: MODEL.minSimilarity, min_margin: MODEL.minMargin, max_tokens: MODEL.maxTokens,
    model_status: row.semantic ? 'computed' : 'not_run', human_override: row.override?.label ?? null,
    override_at: row.override?.at ?? null, effective_label: row.effectiveLabel, effective_method: row.effectiveMethod,
    disagreement: row.disagreement, needs_review: row.needsReview,
  }))
}
export function exportCSV(rows: EvidenceRow[], dataset: string): string {
  const records = exportRecords(rows, dataset)
  if (!records.length) return ''
  // Neutralize spreadsheet formula injection in source-controlled public text.
  const cell = (value: unknown) => { let text = value == null ? '' : String(value); if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"` }
  return [Object.keys(records[0]).map(cell).join(','), ...records.map(r => Object.values(r).map(cell).join(','))].join('\r\n')
}
