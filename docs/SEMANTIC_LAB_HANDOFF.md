# Clearline 2.0 implementation handoff

Ready for owner browser QA. Workspace: `D:/projects/clearline-service-intelligence-upgrade`, branch `codex/clearline-semantic-lab`. No commits were made. The original checkout remained clean at `ccd176cf2b47610d7529062c814260f53d3dc7c1`. Publishing, portfolio changes and browser tools were not used.

## Exact entry parameters

- Portuguese: `/?view=semantic&lang=pt`
- English: `/?view=semantic&lang=en`
- Owner's existing local server: `http://127.0.0.1:4199/?view=semantic&lang=pt` or `lang=en`.

Language parameters take precedence over saved preferences, navigation preserves them and unrelated query parameters, and browser history updates the selected view/language. No publishing metadata was added or changed.

## Command outcomes

| Command | Outcome |
|---|---|
| `npm install --save-exact @huggingface/transformers@3.8.1` in owned checkout | Exit 0; isolated installation and lockfile; npm cache and install temp on D: |
| `npm install` after adding the parent-scoped `sharp: 0.35.5` override | Exit 0; Transformers.js stays exactly 3.8.1; only its nested sharp/platform package versions change |
| `python scripts/sample-narratives.py --source D:/projects/clearline-service-intelligence/data/raw/complaints.csv` | Exit 0; 200 real records, 11 products, IDs/full source narratives/dates/flags retained; source opened read-only |
| `npm test` | Exit 0; **25 tests** passed across 4 files, including the existing 3 analytical tests |
| `.venv/Scripts/python.exe -m pytest -q` with `CLEARLINE_LAB_SOURCE` pointing to the original CSV | Exit 0; **8 tests** passed, including all current pipeline/data tests and exact reconciliation of the 200 source narratives and fields |
| `node scripts/evaluate-semantic.mjs` (`npm run evaluate:semantic`) | Exit 0 after sharp override; actual q8 model inference on 12 synthetic cases + 200 public narratives; all 212 labels/scores/margins identical to the pre-override evaluation; report refreshed in `docs/semantic-evaluation.json` |
| Final `npm run build` | Exit 0; TypeScript + Vite production build; includes sample, separate lab/worker chunks and matching same-origin WASM/MJS assets |
| `git diff --check` | Exit 0; no whitespace errors |
| `D:/projects/agent-revenue-lab/tools/check-rtk.ps1` | Exit 0; global hook configured, synthetic rewrite passed; no hooks installed or duplicated |
| `git --no-optional-locks -C D:/projects/clearline-service-intelligence status --short` | Exit 0; empty output, original clean |
| `npm audit --omit=dev --json` after remediation | **Exit 0; zero production findings**, down from 2 high entries through nested sharp 0.34.5 |
| `npm ls @huggingface/transformers sharp --omit=dev` | Exit 0; Transformers.js **3.8.1** with nested sharp **0.35.5**, override applied |
| Native Transformers.js `RawImage` compatibility probe | Exit 0; actual PNG decode/metadata/raw buffer/resize passed with sharp 0.35.5 and libvips 8.18.7 |
| Browser / Playwright E2E | **Not run**, per owner instruction; actual WASM, network privacy/CORS, rendering and host behavior remain owner QA |

Vite emits a non-failing large-chunk advisory for the chart bundle and model worker. The WASM file is approximately 21.6 MB. Model weights are fetched only following explicit analysis actions, never bundled or precomputed as frontend semantic results.

## Production dependency remediation — 2026-10-31

The final package/lock state uses `overrides["@huggingface/transformers@3.8.1"].sharp = "0.35.5"`. This fixes the three actual sharp advisories while preserving the exact HF version, model SHA, q8 weights and ONNX runtimes. There is no fixed patch within sharp 0.34; the explicit override crosses to 0.35.5 after checking migration compatibility with the actual helper APIs and supported Node version. See [the dependency audit note](SEMANTIC_LAB.md#dependency-audit-note) for advisory links and compatibility limits.

Post-remediation outcomes: **25 frontend tests, 8 Python tests, native compatibility probe, actual 212-text Node inference and full production build passed**. The separate development dependency tree remains outside this bounded production fix; installation reports 9 dev-tree findings, so only the production audit is described as clean.

Files changed in this bounded follow-up: `package.json`, `package-lock.json`, `docs/semantic-evaluation.json`, `docs/SEMANTIC_LAB.md`, and this handoff. Application source, worker/model settings, public CFPB sample and browser QA tooling were not edited. Dependencies and lockfile are now stable for owner browser inference QA.

## Actual evaluation

- Synthetic smoke set: **12/12** semantic expected labels, **6/12** baseline expected labels; no abstentions. This is a tiny authored set, not a validated accuracy benchmark.
- Unannotated CFPB sample: **58/200 uncertain**, **85/200 defined-category disagreements**. No real-data accuracy is claimed.
- The Node evaluation used CPU ONNX with the same pinned q8 weights, tokenizer cap, prototypes and pure core. Browser WASM is implemented but not claimed verified by Node results.

## Changed files

Modified:

- `.gitignore` — exclude isolated temporary/model cache directories.
- `package.json`, `package-lock.json` — exact Transformers.js 3.8.1, scoped sharp 0.35.5 security override and real model evaluation command.
- `README.md`, `README.pt-BR.md` — bilingual release overview, parameters and method guide.
- `src/App.tsx` — existing navigation entry, lazy lab loading, explicit language/view query parameters and history handling; original six pages retained.
- `tests/e2e/app.spec.ts` — existing dashboard contract loops select the original six indexed navigation buttons.

Added:

- `src/SemanticLab.tsx` — bilingual sample loading, model controls, progress/errors/cancel, category/product/flag/search filters, comparison counts, source evidence, correction/undo, session persistence and filtered CSV/JSON exports; isolated English visitor sandbox.
- `src/semantic/core.ts` — pinned model contract, taxonomy/prototypes, original baseline, cosine/abstention, current-layer rules, filters/aggregation, corrections, session scope and exports.
- `src/semantic/inference.ts` — shared actual embedding inference and tokenizer length control.
- `src/semantic/semantic.worker.ts` — actual Transformers.js feature extraction in WASM with same-origin runtime assets and pinned remote model revision.
- `src/semantic/session.ts` — restoration and validation of dataset/model-scoped session results and corrections.
- `src/semantic/lab.css` — responsive styling using the existing identity.
- `src/vite-env.d.ts` — Vite URL/asset typing.
- `src/semantic/core.test.ts` — classification, baseline parity, aggregation, override, filter, export and session contracts.
- `src/SemanticLab.test.tsx` — local-worker UI lifecycle, review persistence, export scope, and sandbox isolation/bounds/cancel tests.
- `src/navigation.test.tsx` — direct links, language precedence, original pages and history tests.
- `public/data/narrative-lab.json` — reproducible public 200-narrative source sample with provenance.
- `scripts/sample-narratives.py` — read-only source extraction and provenance hashing.
- `scripts/evaluate-semantic.mjs` — actual Node model evaluation through shared core, no browser or paid service.
- `tests/fixtures/semantic-synthetic.json` — 12 explicitly synthetic expected-label examples, separate from CFPB evidence.
- `tests/test_narrative_sample.py` — source provenance and full CSV reconciliation.
- `docs/semantic-evaluation.json` — actual model evaluation artifact with per-case outputs and limitations.
- `docs/SEMANTIC_LAB.md` — method, provenance, privacy, runtime limits and owner QA guide.
- `docs/SEMANTIC_LAB_HANDOFF.md` — this manifest and command record.

Ignored local installation, caches and `dist/` are not source deliverables. Do not copy `node_modules`, `.venv`, `.npm-cache`, `.pip-cache`, `.model-cache`, `.tmp`, or pytest/Vite caches into the owner's isolated release checkout. Install from the lockfile there.

## Owner QA focus

Follow [SEMANTIC_LAB.md](SEMANTIC_LAB.md). The priorities are actual browser WASM inference, model download CORS/CSP and privacy inspection, cancel/resume, correction/undo and reload, matching current filtered export scope across pagination, visitor-text exclusion from all CFPB state, explicit PT/EN links and mobile fit. No browser CORS failure was observed because browser tools were intentionally not used; Node model download and real inference succeeded.
