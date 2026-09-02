# ADR-0028 — Extract vision enrichment (screenshot + reasoner)

**Status:** accepted (amended 2026-08-22)  
**Date:** 2026-08-02  
**Wave:** Vision 2B · Epic [#148](https://github.com/Hepteract-Group/marketing-os/issues/148) · Feature [#370](https://github.com/Hepteract-Group/marketing-os/issues/370)  
**Related:** ADR-0027 (Ad Generator / ExtractedBrief), ADR-0007 (model profiles), ADR-0011 (local-first), ADR-0018 (trust / spend UX)  
**Amends:** extract path in [ad-generator-and-variants.md](../architecture/ad-generator-and-variants.md) (reasoner step was already allowed; this ADR locks screenshot + soft-fail + spend/UI). Does **not** change ADR-0027’s brief schema, variant model, or `apply_brief` modes.  
**Amended by [ADR-0089](./0089-product-extracts.md):** one full-page screenshot per URL is not the product bar. Product Extracts store many public-page stills + text, scored and operator-visible. This ADR still governs the extract job’s vision enrichment and spend consent.  
**Amended by [ADR-0094](./0094-hosted-studio-workers-on-fly.md):** hosted extract/render Chromium runs on a dedicated Fly app, not Vercel and not Postiz.

## Context

Deterministic URL extract (#368/#369) can seed logo, stills, and palette, but messaging/tone still collapse to weak heuristics (“Try {brand}”). Founders need extract to capture **brand essence** for hooks, CTAs, and tone — which requires a vision/reasoner pass over page context, not more CSS regex.

Architecture already allows: adapters stay deterministic; the **extract job** may call a reasoner with a fixed schema prompt. Open questions were: where enrichment runs, whether to screenshot, spend gating, screenshot infra, and failure behaviour. Founder decisions for #370 are locked below.

## Decision

### 1. Enrichment is a step inside `runExtractJob`

One Generation Job (`role: extract`), one modal/banner. Order:

1. Deterministic adapters (HTML/PDF digest, SSRF-safe).
2. Materialize logo/still + CSS colors (#368/#369).
3. **If reasoner is not `mock-*`:** capture screenshot → vision/reasoner fill/refine `ExtractedBrief` (hooks, CTAs, tone, displayName, style note for Path C).
4. Persist `extracted_briefs` as today.

No separate `enrich` job role in v1.

### 2. Reasoner inputs (v1)

| Input | Required |
|---|---|
| Text digest + ranked CSS colors | yes |
| Downloaded logo / still assets | when present |
| **Full-page screenshot** (PNG) | yes when enriching |

Screenshot is stored as a project/blob asset (debug + future re-enrich). Vision model sees screenshot + logo/still; text model context includes digest + color guesses.

### 3. Screenshot via Playwright in the extract worker

- Capture with Playwright/Chromium inside the extract worker (`extract:local` locally; hosted Fly worker per [ADR-0094](./0094-hosted-studio-workers-on-fly.md)). No third-party screenshot SaaS in v1.
- **SSRF:** navigate only after `assertSafeFetchUrl` (and re-check final URL after redirects) — same fail-closed policy as URL fetch (`core/creative/src/extract/ssrf.ts`): http(s) only, no credentials, block private/link-local/metadata.
- Caps: navigation timeout, viewport size, max PNG bytes.

### 4. Spend gate

- **`mock-*` reasoner (“No LLM” in UI):** deterministic extract only — **£0**, no screenshot, no LLM.
- **Any other allowlisted reasoner:** always run enrichment; `estimateExtractGbp` must be non-zero and include screenshot + vision/reasoner estimate.
- **Spend consent (amended 2026-08-22 / #723):** clicking **Extract** on the Ad Generator URL/PDF form or Brand Studio URL extract is consent. There is no spend `ConfirmDialog`. Enqueue fails only when monthly remaining is £0 or cannot cover the estimate; the error stays **on the form**. Weekly/project soft caps do not block extract (`requireConfirm: false`). Chat Send still offers **No LLM**; extract forms omit it and default the picker to a paid Reason model without changing the project’s stored chat reasoner. The extract HTTP path coerces `mock-*` to a paid reasoner for the job only. `mock-*` remains valid on `enqueueExtractJob` for CI. Video/image `confirmSpend` is unchanged.

### 5. Founder-facing copy: “No LLM”

Internal ids remain `mock-*` / `mock-reasoner`. Studio UI labels that option **“No LLM”** (never “mock” in founder chrome).

### 6. Soft-fail enrichment

If screenshot or reasoner fails (timeout, unsafe URL after redirect, invalid JSON, provider error):

- Job status stays **`ready`** with the **deterministic** brief.
- Persist a warning (job error message and/or brief confidence note) that enrichment was skipped.
- Lower `confidence` on fields that would have been LLM-derived.
- Founder can still **Apply**; brief UI should surface low-confidence fields (existing threshold).

Do **not** fail the whole extract solely because enrichment failed.

### 7. Confidence

- Deterministic-only path: keep heuristic confidence scores.
- Successful enrichment: raise confidence on messaging/tone/displayName fields the model filled; keep palette/logo confidence from deterministic signals unless the model explicitly overrides with structured fields (`primaryColor` / `accentColor` hex in the enrichment JSON).
- Soft-fail: mark messaging fields at or below `BRIEF_LOW_CONFIDENCE_THRESHOLD` when enrichment was attempted and skipped.

## Consequences

- #370 implements Playwright + vision enrich inside `run-extract.ts`, restores non-zero `estimateExtractGbp` for non-mock reasoners, and renames mock picker copy to “No LLM”.
- Local-first: founders need Chromium available to the extract worker for paid/enriched extracts (document in Runbook when #161 lands).
- CI / “No LLM” stays free and deterministic.
- Future screenshot SaaS or a dedicated `enrich` job would need a new ADR.

## Rejected

- Separate `enrich` job / second banner for v1.
- Third-party screenshot API as the v1 capture path.
- Failing extract when enrichment fails.
- Showing “mock” as the founder-facing reasoner label.
- Calling LLMs inside URL/PDF **adapters** (adapters remain pure fetch/parse).
