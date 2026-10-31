import { isTopic, sessionKey, type Narrative, type ReviewState, type SemanticResult } from './core'

export const emptyState = (): ReviewState => ({ results: {}, overrides: {} })
export function readSession(storage: Pick<Storage, 'getItem'>, dataset: string, rows: Narrative[]): ReviewState {
  const state = emptyState(), ids = new Set(rows.map(r => r.id))
  try {
    const saved = JSON.parse(storage.getItem(sessionKey(dataset)) ?? 'null')
    if (!saved || typeof saved !== 'object') return state
    for (const [id, value] of Object.entries(saved.results ?? {})) {
      const r = value as SemanticResult
      if (ids.has(id) && r && (isTopic(r.label) || r.label === 'uncertain') && isTopic(r.topLabel)
        && Number.isFinite(r.similarity) && r.similarity >= -1 && r.similarity <= 1
        && Number.isFinite(r.margin) && r.margin >= 0 && r.margin <= 2
        && Array.isArray(r.scores) && r.scores.length === 6
        && r.scores.every(s => isTopic(s.label) && Number.isFinite(s.score) && Math.abs(s.score) <= 1)) state.results[id] = r
    }
    for (const [id, value] of Object.entries(saved.overrides ?? {})) {
      const r = value as { label: unknown; at: unknown }
      if (ids.has(id) && r && isTopic(r.label) && typeof r.at === 'string' && Number.isFinite(Date.parse(r.at))) state.overrides[id] = { label: r.label, at: r.at }
    }
  } catch { /* Missing, blocked, or corrupt storage starts a fresh session. */ }
  return state
}
