// Real model evaluation, without a browser. No CFPB accuracy labels are invented.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'
import { env, pipeline } from '@huggingface/transformers'

const root = resolve(import.meta.dirname, '..')
await mkdir(resolve(root, '.tmp'), { recursive: true })
const compiled = resolve(root, '.tmp/semantic-evaluation-core.mjs')
await build({ stdin: { contents: "export * from './src/semantic/core'; export * from './src/semantic/inference';", resolveDir: root, loader: 'ts' }, outfile: compiled, bundle: true, platform: 'node', format: 'esm' })
const { MODEL, infer, baseline } = await import(pathToFileURL(compiled).href)
env.cacheDir = resolve(root, '.model-cache')
env.allowLocalModels = false
env.useBrowserCache = false
const synthetic = JSON.parse(await readFile(resolve(root, 'tests/fixtures/semantic-synthetic.json'), 'utf8'))
const dataset = JSON.parse(await readFile(resolve(root, 'public/data/narrative-lab.json'), 'utf8'))
let lastFile = ''
const started = performance.now()
const extractor = await pipeline('feature-extraction', MODEL.id, {
  revision: MODEL.revision, dtype: MODEL.dtype, device: 'cpu',
  progress_callback: progress => { if (progress.status === 'done' && progress.file !== lastFile) { lastFile = progress.file; console.log(`Loaded ${progress.file}`) } },
})
const results = {}
await infer(extractor, [...synthetic.cases, ...dataset.rows], (id, result, done) => {
  results[id] = result
  if (done % 25 === 0) console.log(`Computed ${done}/${synthetic.cases.length + dataset.rows.length}`)
})
await extractor.dispose()
const cases = synthetic.cases.map(row => ({ ...row, baseline: baseline(row.narrative), semantic: results[row.id] }))
const correct = cases.filter(row => row.semantic.label === row.expected).length
const accepted = cases.filter(row => row.semantic.label !== 'uncertain')
const real = dataset.rows.map(row => ({ id: row.id, baseline: baseline(row.narrative), semantic: results[row.id] }))
const report = {
  createdAt: new Date().toISOString(), model: MODEL,
  execution: { runtime: process.version, device: 'cpu', note: 'Actual q8 ONNX inference in Node using the same infer()/classify() core as the browser worker. Browser WASM execution and network privacy require owner QA.' },
  seconds: Math.round((performance.now() - started) / 1000),
  synthetic: { kind: synthetic.kind, total: cases.length, correct, baselineCorrect: cases.filter(row => row.baseline === row.expected).length,
    uncertain: cases.length - accepted.length, coverage: accepted.length / cases.length,
    accuracyIncludingAbstentions: correct / cases.length, acceptedAccuracy: accepted.length ? correct / accepted.length : null, cases },
  publicSample: { datasetVersion: dataset.meta.version, total: real.length,
    uncertain: real.filter(row => row.semantic.label === 'uncertain').length,
    disagreements: real.filter(row => row.semantic.label !== 'uncertain' && row.semantic.label !== row.baseline).length,
    accuracy: null, note: 'Unannotated public narratives. Disagreement is not accuracy or proof of improvement.', results: real },
}
const target = resolve(root, 'docs/semantic-evaluation.json')
await writeFile(target, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ report: target, seconds: report.seconds, synthetic: { total: cases.length, correct, baselineCorrect: report.synthetic.baselineCorrect, uncertain: report.synthetic.uncertain }, publicSample: { total: real.length, uncertain: report.publicSample.uncertain, disagreements: report.publicSample.disagreements } }, null, 2))
