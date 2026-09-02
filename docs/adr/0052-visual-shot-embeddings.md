# ADR-0052 — Visual shot embeddings (the retrieval grain)

**Status:** accepted  
**Date:** 2026-08-20  
**Wave:** Vision **2J** · Plan index **26** · Epic [#579](https://github.com/Hepteract-Group/marketing-os/issues/579)  
**Related:** ADR-0032 (asset intelligence), ADR-0007 (profiles), ADR-0009 (Blob + Postgres), ADR-0018 (spend), ADR-0047 (library-first Moments), ADR-0053 (analyze-on-index)  
**Does not supersede:** ADR-0032 — tables, product scope, auto-index, Story Builder, and pgvector stay.  
**Amends:** ADR-0032 §3 item 4 — visual embedding of a Shot keyframe is **required** once thumbs exist; it is no longer an optional skip that can stay “v1 text only.”

## Context

Wave 2C indexed assets. Wave 2I (#515) writes **per-shot text** embeddings (caption + transcript window → `openai/text-embedding-3-small`, 1536-d). Visual embeddings are still hard-skipped until `#582` writes `kind=visual` rows. **[#580](https://github.com/Hepteract-Group/marketing-os/issues/580) extracts keyframe thumbs** (mid-window JPEG / still copy) into Azure Blob so `thumb_blob_key` is no longer silently null.


Text-of-caption search cannot answer “product close-up,” “red UI on a laptop,” or “the Export screen” unless a VLM happened to write those words. Twelve Labs’ Marengo works because **keyframes and text queries share one vector space**. We copy that pattern. We do not buy their Index.

## Decision

### 1. The Shot is the retrieval grain

`find_moments` ranks **Shots**, not whole files. Whole-asset `kind=text` rows (`shot_id` null) remain for `find_assets` / Story Builder file hits. They are not the picture-track unit.

A **Moment** is still a retrieved Shot (optional transcript window). Visual rank does not invent a new noun.

### 2. Keyframe thumbs are a pipeline stage, not a nice-to-have

After heuristic (or later semantic) shot bounds, extract one keyframe per Shot, write it to Azure Blob, store `asset_shots.thumb_blob_key`. Images use the still itself.

Without thumbs: no visual embed, weak video captions, no Analyze frames. Soft-skip is allowed only when extract fails; the index chip must show that visual is missing. Silent “text only in v1” is rejected.

### 3. One multimodal space for visual retrieve

Write `asset_embeddings.kind = 'visual'` keyed by `shot_id`.

The embedder must accept **both** a keyframe and a text query into the **same** vector space (CLIP-family / Gateway multimodal embed — exact `model_id` pinned in the implementation slice). That is what makes “product close-up” retrieve a shot that was never captioned that way.

**Dims:** do not force a non-1536 model into `vector(1536)`. If the visual model is not 1536-d, add a dedicated visual column or table in that slice’s migration. Text rows stay 1536 / `openai/text-embedding-3-small`.

**Pin (#581):** `google/gemini-embedding-2` with Matryoshka `outputDimensionality: 1536`. `ci-stub` → `mock-embed-visual`. Pipeline writes land in #582.

**Writes (#582):** index job calls `embedShotVisualForIndex` per Shot with a thumb and persists `kind=visual` + `shot_id`. Missing thumbs and API errors stay `ready`.

**What does not count as shipping this ADR:** captioning the thumb with a VLM and then calling `text-embedding-3-small`. That may still run to improve `kind=text` per-shot rows. It is not a visual embedding.

### 4. Fusion, then fallback

`find_moments` for a text query:

1. Visual nearest-neighbour in the multimodal space.
2. Existing per-shot text nearest-neighbour.
3. Reciprocal rank fusion (or a documented weighted merge).
4. Tag / caption / transcript-window keyword fallback (already shipped).

Missing visual rows must not fail the tool. Hits farther than a pinned max distance are dropped, same idea as `MAX_TEXT_SEMANTIC_DISTANCE`.

Image-as-query (search by still) is a follow-up slice once the multimodal space exists. v1 is text → visual+text fusion.

### 5. Same Index, same spend gates

Product-scoped pgvector on Synawood Supabase. No Twelve Labs Index, no Pinecone, no second product library.

Visual embed is a paid index stage: estimate → confirm / caps (ADR-0018). Upload auto-index may soft-skip visual near caps while still writing thumbs + text (same pattern as caption). Reindex / Retry with `confirmSpend: true` backfills visual.

New Model Profile role **`embed_visual`**. Distinct from `caption` (VLM) and from the pinned text embedder. `ci-stub` uses a deterministic mock vector of the pinned visual dim.

### 6. Backfill

Existing library: `POST …/index-missing` and per-asset reindex must extract thumbs and write visual rows. Wave 2J is not done while only new uploads have visual.

## Rejected

- Twelve Labs Marengo (or any vendor) as the source-of-truth Index (ADR-0032 already rejected an external vector DB; this is stronger lock-in).
- Treating per-shot **text** embeddings (#515) as “visual embeddings done.”
- Leaving `thumb_blob_key` null and calling visual “optional.”
- Stuffing a mismatched-dim model into `vector(1536)`.
- A second search stack for Story Builder vs chat vs assemble.
- Face / celebrity visual search (ADR-0032 flag stays default off).

## Consequences

- Plan **26** / Wave **2J** / epic [#579](https://github.com/Hepteract-Group/marketing-os/issues/579) implements this before Analyze consumers that need frames.
- `#166` closed as text-only; do not reopen it — new slices own thumbs + visual.
- `#515` stays closed (per-shot **text** + transcript windows). Visual rank is additive.
- Better Moments unblock library-first ads (ADR-0047 / epic #512) without changing the ad contract (ADR-0049).
- CONTEXT: **visual shot embedding**. Architecture: `docs/architecture/asset-intelligence.md`.
