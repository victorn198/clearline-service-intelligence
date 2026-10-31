import { classify, MODEL, TAXONOMY, type Narrative, type SemanticResult, type Topic } from './core'

// The worker and the actual Node evaluation use precisely this inference path.
export type Extractor = {
  (texts: string[], options: { pooling: 'mean'; normalize: boolean }): Promise<{ tolist(): number[][] }>;
  tokenizer: { model_max_length: number };
}
const OPTIONS = { pooling: 'mean', normalize: true } as const
export async function infer(extractor: Extractor, rows: Pick<Narrative, 'id' | 'narrative'>[], onResult: (id: string, result: SemanticResult, done: number) => void) {
  // FeatureExtractionPipeline v3.8.1 always truncates at tokenizer.model_max_length;
  // passing max_length to the pipeline call would be silently ignored.
  extractor.tokenizer.model_max_length = MODEL.maxTokens
  const descriptions = TAXONOMY.flatMap(t => t.prototypes.map(text => ({ label: t.id as Topic, text })))
  const embeddings = (await extractor(descriptions.map(d => d.text), OPTIONS)).tolist()
  const prototypes = descriptions.map((d, i) => ({ label: d.label, vector: embeddings[i] }))
  for (let i = 0; i < rows.length; i++) {
    const vectors = (await extractor([rows[i].narrative], OPTIONS)).tolist()
    onResult(rows[i].id, classify(vectors[0], prototypes), i + 1)
  }
}
