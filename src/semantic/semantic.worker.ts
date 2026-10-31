import { env, pipeline } from '@huggingface/transformers'
import { MODEL, type Narrative } from './core'
import { infer, type Extractor } from './inference'
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url'
import wasmModuleUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url'

env.allowLocalModels = false
// One WASM thread works without cross-origin isolation; all text stays in this worker.
env.backends.onnx.wasm!.numThreads = 1
env.backends.onnx.wasm!.proxy = false
// Ship the matching runtime assets with the app instead of depending on a second CDN.
env.backends.onnx.wasm!.wasmPaths = { wasm: wasmUrl, mjs: wasmModuleUrl }

self.onmessage = async (event: MessageEvent<{ rows: Pick<Narrative, 'id' | 'narrative'>[] }>) => {
  try {
    const extractor = await pipeline('feature-extraction', MODEL.id, {
      revision: MODEL.revision, dtype: MODEL.dtype, device: MODEL.device,
      progress_callback: (progress: unknown) => self.postMessage({ type: 'download', progress }),
    })
    self.postMessage({ type: 'inference' })
    await infer(extractor as unknown as Extractor, event.data.rows, (id, result, done) => self.postMessage({ type: 'result', id, result, done }))
    await extractor.dispose()
    self.postMessage({ type: 'complete' })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
