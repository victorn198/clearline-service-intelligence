# Clearline 2.0 semantic narrative laboratory

Implemented in `codex/clearline-semantic-lab`, based on `ccd176c`. The six existing dashboards and their PT/EN labels remain available. No commit, publication, portfolio edit, or browser QA is performed by the implementation agent.

## Entry and execution

- Navigation: **Semantic Laboratory** / **Laboratório Semântico**.
- Direct links: `/?view=semantic&lang=pt` and `/?view=semantic&lang=en`. `lang=pt/en` takes precedence over the saved language preference; the language button updates that parameter. Works on a static host without a server route. Other query parameters are preserved, and browser back/forward updates both page and explicitly selected language.
- The laboratory has its own category, product, source/review flag and text filters. Dashboard period/company/geography filters do not affect it.
- The baseline and public evidence are immediately available without downloading or running a model.
- **Analyse with model** / **Analisar com modelo** creates a dedicated worker, downloads the public model, and classifies all pending sample rows. It is intentionally independent of current view filters.
- Cancel terminates the worker, retains completed rows and allows analysis of the remaining rows. Navigating away also terminates the worker. Errors preserve completed evidence and the baseline; retry is explicit.

```powershell
$env:npm_config_cache="$PWD/.npm-cache"
$env:TEMP="$PWD/.tmp"
$env:TMP=$env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
npm ci
npm run dev
npm test
npm run build
npm run evaluate:semantic
```

Run these commands only in the owned checkout, on D:. Model evaluation caches under `.model-cache/` and writes its temporary compiled core under `.tmp/`. Neither is part of the release. The static build contains the sample and the matching WASM/MJS runtime assets, but does **not** contain model weights. The first explicit analysis downloads weights/tokenizer/configuration from Hugging Face. No backend, hosted inference, account, API key or paid service is required by the laboratory.

## Model and method

| Contract | Value |
|---|---|
| Runtime | `@huggingface/transformers` exactly `3.8.1` |
| Model | `Xenova/all-MiniLM-L6-v2` |
| Revision | `751bff37182d3f1213fa05d7196b954e230abad9` |
| Model license | Apache-2.0 |
| Quantized weights | `onnx/model_quantized.onnx`, q8 |
| Browser execution | WASM, one thread, worker; no cross-origin isolation required |
| Embeddings | Mean pooling, L2 normalization, 384 dimensions |
| Taxonomy | Six categories, two explicit English prototypes each; `clearline-topics-v1` |
| Scoring | Highest cosine similarity among each category's prototypes |
| Abstention | Top cosine < 0.30 **or** margin over second category < 0.035 |
| Text limit | First 256 WordPiece tokens, configured on the pipeline tokenizer |

This is a **semantic-similarity classifier**, inspired by the semantic-columns approach. It does not integrate the TADA runtime and is not a freeform LLM agent. Cosine similarity is not probability, confidence, factual verification, or validated real-world accuracy. Thresholds are heuristic review rules. Prototypes and thresholds are published in the interface. Changing prototypes or preprocessing requires a new taxonomy version so saved sessions cannot silently mix implementations.

Long original narratives remain intact in the evidence panel and exports; only the model input is truncated. Decisive context beyond the limit can be missed. The model is used on original English CFPB text; switching UI language does not translate evidence or change embeddings.

Official references: [model card](https://huggingface.co/Xenova/all-MiniLM-L6-v2), [pinned model files](https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/751bff37182d3f1213fa05d7196b954e230abad9), [Transformers.js 3.8.1 pipelines](https://huggingface.co/docs/transformers.js/v3.8.1/en/pipelines).

## Public sample and provenance

`public/data/narrative-lab.json` contains **200 real published CFPB narratives** from the existing official CSV export of 2025-01-01 through 2025-01-07. No narrative has been synthesized, translated, shortened, or manually relabeled as ground truth. Complaint IDs link directly to the CFPB record.

- Source CSV SHA256: `9736c33c73df5cb070a5fde3c170f4b50e7fc102a7ab9cc8494b3687df4f33f7`.
- Dataset version: `cfpb-200-95525c56195d4220`.
- Eligible published narratives in the original export: 20,330.
- Deterministic sampling: round robin over product × timely-response strata, taking descending SHA256(`clearline-lab-v1:ID`) within each stratum until 200 rows. The selected records are emitted in numerical ID order.
- The sample has 11 products, 123 timely and 77 untimely records. It deliberately enriches rare products and response exceptions; it is **not representative**, and its shares must not be interpreted as population estimates.
- Every row preserves the original complaint ID, received/sent dates, product, issue, company, jurisdiction, narrative, company response and timely flag. Metadata preserves the source/export URLs, license, selection description and source/record hashes.

Reproduce from a read-only source CSV:

```powershell
python scripts/sample-narratives.py --source D:/path/to/original/complaints.csv
$env:CLEARLINE_LAB_SOURCE='D:/path/to/original/complaints.csv'
.venv/Scripts/python.exe -m pytest -q
```

The reconstruction uses the current `pipeline/topics.py` dictionary, read through Python AST, to record baseline labels. Frontend tests reconcile every released label and every rule term against that dictionary snapshot. The optional source-reconciliation test compares **all 200 full narratives and source fields**, including dates and flags, with the original CSV and checks its SHA256.

The laboratory uses only CFPB **timely-response flag** and **monetary-relief indicator/share** for response analytics. It does not calculate actual resolution duration or monetary/refund amounts. `monetaryRelief` is true only when the response equals **Closed with monetary relief**; **Closed with non-monetary relief** is false. Complaint received/sent dates are never subtracted to invent a resolution time. The v1 marts and their existing calculations are preserved.

## Review, filters and exports

Each row independently stores:

1. **Keyword baseline**: original ordered substring rules from `pipeline/topics.py`, with the original first-match priority.
2. **Computed semantic result**: model category or **uncertain**, top prototype category, cosine, margin and all category similarities. Missing results are explicitly **not run**, never baseline disguised as inference.
3. **Human override**: reviewed category and timestamp. It changes the effective category without mutating either underlying method or retraining the model. Undo removes the override and restores the semantic result (or baseline if no result exists).

Current categories use override → computed semantic result → baseline. Category filtering applies to this effective category. Counts, rates, comparison tables and CSV/JSON exports are all computed from the same filtered rows. Semantic counts include only computed rows; disagreement excludes uncertain results. A row needs review when there is no human correction and inference is pending, uncertain, or disagrees with baseline.

The review queue displays 15 rows per page; export includes **every filtered row across pages**. Exports contain original narrative evidence, complaint/source link, dates and flags, baseline/method/version, semantic scores and status, model/revision/runtime/dtype/device, taxonomy/thresholds/token limit, override/timestamp and effective category/method. JSON also records the active filters and source metadata. CSV uses quoted fields and escapes multiline text; formula-like **source strings** are prefixed with an apostrophe for spreadsheet safety. JSON preserves raw evidence exactly. Empty filtered scopes disable export.

### Visitor text sandbox

At the bottom of the laboratory, visitors can paste up to **2,000 characters of English text**. The explicit **Analyse pasted text locally** action uses the exact same worker, pinned model, tokenizer limit, taxonomy prototypes, cosine classifier and abstention rules. It shows a separate keyword baseline and computed similarities. Analysis is serial with sample analysis and supports cancel; changing/clearing the input removes its prior result. Only the leading 256 WordPiece tokens are embedded. English is stated explicitly because the model and prototypes are English.

Visitor input/results remain only in component memory, and never enter CFPB rows, counts, source metadata, corrections, sessionStorage or CSV/JSON exports. Leaving the laboratory discards them. Visitor input is sent to the local worker through `postMessage`, never a remote service. Worker construction and model download still require an explicit action.

Results and overrides use **sessionStorage**, scoped to dataset version, model revision, Transformers version, dtype, taxonomy, thresholds and token limit. They survive reloads and navigation within the tab. They do not sync to other tabs/accounts and are not a durable review database. Reset clears current review state; it does not delete the browser's separate model-asset cache. Blocked/quota-limited storage produces a visible warning; export remains available. Corrupt saved state is ignored and unknown record IDs are not restored.

## Privacy and owner browser QA

The worker receives only the public record ID and narrative via `postMessage`. The runtime computes embeddings locally; it never calls a remote inference service. The search query and corrections are not sent remotely. Remote traffic is limited to public model/tokenizer/configuration downloads. Matching WASM/MJS files are bundled into the same-origin build. Normal source/model documentation links open only when clicked.

The implementation agent has **not** used browser tools. Owner QA should verify:

1. Open `/?view=semantic` in a fresh tab: 200 source rows and baseline appear before any model download. PT/EN and the six existing dashboards still work. Verify mobile fit and keyboard access.
2. Capture network requests, then click **Analyse with model**. Confirm q8 weights are resolved at the pinned revision; only model/config/tokenizer/runtime assets are downloaded, with no narrative/search/correction text in request URLs or bodies. Check the actual browser WASM inference finishes and populates computed scores.
3. Cancel during download and during inference. Completed rows remain; resume analyses only pending rows. Verify navigation away stops the worker and reload restores the completed results without auto-running the model.
4. Compare baseline and computed categories, including uncertain rows. Review original full narrative and CFPB link. Apply a correction, filter by the new current category, undo, and reload; verify layer separation.
5. Combine category/product/flag/search filters and export CSV/JSON from the second pagination page. File row count and IDs must equal **all filtered rows**, with current corrections and pending model statuses. Check empty results disable export.
6. Block model downloads to exercise the error/retry path; the baseline must remain usable. Node downloads succeeded, but that does **not** prove browser CORS or host CSP. If the chosen host blocks Hugging Face model downloads, owner must inspect the actual error and may arrange same-origin public model hosting; the implementation makes no CORS-success claim.
7. Paste English text in the visitor sandbox. Verify the actual local model computes a result, cancellation works, and no visitor text appears in CFPB counts, sessionStorage, exports, or network requests. Change/clear text and confirm its prior result disappears. Verify both explicit language links override any previously stored language.

## Verification and evaluation

`npm test` covers baseline parity, true cosine scoring and abstention, missing/invalid embeddings, aggregation and denominators, actual scope filters, override/undo, version-scoped restoration, source metadata, CSV escaping, local worker start/cancel/resume/error behavior, PT/EN interactions, export pagination, JSON model status, direct links and language/history navigation. It also checks visitor input bounds, worker routing, cancellation and exclusion from CFPB state/exports. UI worker doubles are explicitly synthetic test fixtures and are not shipped in the app.

`npm run evaluate:semantic` performs **actual q8 ONNX inference in Node on CPU**, using the exact same `infer()` and pure `classify()` implementation as the browser worker. It does not use mocked vectors or relabel keyword matches as model output. The Node backend is explicitly different from the browser WASM backend; browser verification belongs to the owner.

The checked-in [evaluation artifact](semantic-evaluation.json) records:

- 12 short, explicitly **SYNTHETIC** evaluation cases, two per category: semantic 12/12, keyword baseline 6/12, zero abstentions. These simple examples are a smoke test, not an independent or representative accuracy benchmark.
- 200 real, **unannotated** CFPB records: 58 uncertain, 85 defined-category disagreements with baseline. There is **no real-data accuracy estimate** and no claim that disagreement proves improvement.
- Per-case labels, cosine scores, margins, model/revision/runtime, dataset version and execution environment.

Final command outcomes are recorded in [SEMANTIC_LAB_HANDOFF.md](SEMANTIC_LAB_HANDOFF.md). Browser/E2E runs are deliberately left to the owner. Existing dashboard E2E loops now select the six original navigation items using their `data-index` attribute, so the new laboratory is not incorrectly subjected to the old five-tab/KPI dashboard contract.

## Dependency audit note

Production audit was remediated on 2026-10-31 with an exact, parent-scoped override:

```json
"overrides": {
  "@huggingface/transformers@3.8.1": {
    "sharp": "0.35.5"
  }
}
```

Before remediation, `npm audit --omit=dev` reported two high-severity package entries: the nested `sharp@0.34.5` and its Transformers.js parent. They arose from [libvips advisories](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [libheif advisories](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), and the [librsvg advisory patched in sharp 0.35.5](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). After the override, the same **production audit exits 0 with zero findings**. The browser worker uses Transformers.js's browser export, so sharp is not included in its bundle.

This is a deliberately reviewed override outside Transformers.js's declared `sharp ^0.34.1` range, **not** a semver-compatible 0.34 patch; no fixed 0.34 patch exists. The [0.35.0 migration changes](https://sharp.pixelplumbing.com/changelog/v0.35.0/) were checked against Transformers.js 3.8.1's actual image helper calls. Removed deprecated options/properties are not used there; the new Node >=20.9 requirement is already exceeded by this project's Vite toolchain (Node ^20.19 or >=22.12) and the tested Node 24.13.0 environment. Native PNG decode, metadata, raw-buffer conversion and resize through Transformers.js `RawImage` passed with sharp 0.35.5 / libvips 8.18.7. Compatibility is verified for this application's exercised paths, not all Transformers.js image workloads.

Transformers.js remains exactly **3.8.1**. Model revision, q8 weights, ONNX runtimes and frontend source are unchanged. Tests (25 frontend and 8 Python), production build and actual Node inference on all 212 texts passed after the dependency change. Every semantic output, score and margin was identical to the pre-override evaluation. Lockfile version changes are confined to that nested sharp dependency and its platform packages.

The unfiltered installation audit still reports 9 development-tree findings (1 moderate, 6 high, 2 critical), including the separate sharp 0.35.2 under Wrangler/Miniflare. This bounded task remediated production dependencies only; it does not claim a clean development dependency audit or alter publishing tooling.
