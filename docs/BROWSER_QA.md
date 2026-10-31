# Browser verification — 2026-10-31

The owner exercised the real application in the Codex in-app Chromium browser, not a mocked worker.

- Direct `?view=semantic&lang=pt` opens the Portuguese laboratory; English is independently selectable.
- The pinned q8 model completed all **200** source narratives using the actual browser WASM worker. The UI reported **83** baseline/model disagreements and **60** uncertain results. These counts are observations, not accuracy scores.
- A manual category correction increased the human-correction count from 0 to 1; undo restored it to 0 without changing the model outputs.
- A synthetic visitor sentence about an unauthorized card account received `Identity & fraud`, cosine **0.731**, margin **0.226**. The source sample stayed at 200 records. The visitor text was not included in the source export.
- Applying the `Student loan` product filter and downloading JSON produced **22** source records, all with the same product, computed model state, pinned model revision, WASM metadata and no human override after undo.
- Original Service Command returned to an enabled, queryable state without console errors after leaving the laboratory.
- At a 390px test viewport the laboratory body fitted its available width; wide data tables use their own scrolling.

The native CPU evaluation in `semantic-evaluation.json` reports 85 disagreements and 58 abstentions on the same unannotated sample. The browser observations differ slightly. Both are retained: threshold decisions must not be assumed identical across ONNX runtimes, and neither run supplies human-labelled ground truth for the CFPB sample. No thresholds were adjusted to improve these counts.

Privacy verification consists of the actual local inference exercise and inspection of the application/worker code. No application endpoint uploads narrative text; remote requests load the public dataset and pinned model/runtime assets. A separate network-proxy capture was not performed.

These are local application checks. Hosted-origin, iframe integration and publication results are recorded separately by the owner.
