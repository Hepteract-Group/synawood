# ADR-0032 — Asset intelligence + Story Builder

**Status:** accepted  
**Date:** 2026-08-08  
**Wave:** Vision 2C · Plan index **10** · Epic [#162](https://github.com/Hepteract-Group/marketing-os/issues/162)  
**Related:** ADR-0005 (generative media), ADR-0007 (model profiles), ADR-0009 (Blob + Postgres), ADR-0015 (library recall / `@asset` reference), ADR-0016 (Media bin chrome), ADR-0018 (trust / cost), ADR-0029 (suggestions consume `find_assets`)  
**Does not supersede:** ADR-0015 — recall + chat reference stay; this ADR adds **searchable understanding** (tags, shots, embeddings, transcripts) on top.  
**Amended by [ADR-0052](./0052-visual-shot-embeddings.md):** visual shot embeddings are required, not an optional skip.  
**Amended by [ADR-0053](./0053-analyze-on-index.md):** search, segment, compliance, highlights, and reasoning are consumers of this same index — not new pipelines.  
**Amended by [#525](https://github.com/Hepteract-Group/marketing-os/issues/525):** generated video clips index the same way as uploads. `persistGeneratedAsset` calls `startAssetIndexAfterAttach` after a video row is saved. Index enqueue/run soft-fails; generate stays ready. Stills and audio are not auto-indexed on generate in this slice.  
**Amended by [#580](https://github.com/Hepteract-Group/marketing-os/issues/580):** after heuristic shot bounds, the index job extracts a mid-window keyframe (or copies the still) to Azure Blob and stores `asset_shots.thumb_blob_key`. Extract failures soft-fail: shot rows remain, `last_error` records **Keyframe thumbs missing**, and the Media bin indexing chip shows the reason with Retry. This slice does not write `kind=visual` embeddings.

## Context

Founders dump dozens of clips and stills into a product. Today Media bin is a flat list with probe blobs; Director / suggestions / chat cannot ask “funny moments,” “product close-ups,” or “travel montage candidates.” Vision Wave **2C** indexes assets (probe → shots → caption/tags → embeddings → transcript) and exposes Story Builder as a **Media bin mode** driven by retrieval tools — not a second editor.

Epic children [#163](https://github.com/Hepteract-Group/marketing-os/issues/163)–[#178](https://github.com/Hepteract-Group/marketing-os/issues/178) already exist but cited ADR-0029 by mistake; **this ADR is the contract.**

## Decision

### 1. Product-scoped intelligence

`assets` already have `product_id` (optional `project_id`). Index rows live at **product** scope so Story Builder and `find_assets` search across the product library. Project-only filters are query args, not a separate index.

### 2. Auto-index on attach; reindex API for rebuilds

When an asset is uploaded / attached (bin, brand import, extract materialize, **generated video clip**), enqueue an **index** pipeline job. UI shows a persistent indexing chip (#173). Founders can force **reindex** via API/UI. Lazy-only indexing is rejected (search would cold-start empty). Index failure must not fail upload or generate.

### 3. Pipeline stages (orchestrated, idempotent)

Order (#164–#167):

1. **Probe** — duration, dimensions, fps, codec (cheap; may reuse `assets.probe`)
2. **Shots** — shot boundaries + keyframe thumbs for video; single “shot” for images
3. **Caption + tags** — VLM (model profile **caption** role, #169); tags normalized strings
4. **Embeddings** — text embedding of caption (+ transcript excerpt); optional visual embedding of keyframe
5. **Transcribe** — reuse Whisper / `transcribe` generator (#167); optional for short clips / audio

Each stage is skippable if inputs missing; failures soft-fail with `index_status = failed` + reason (ADR-0018). Face detection is **flagged off by default** (#176).

### 4. Storage: Postgres + pgvector in Synawood Supabase

- Extension `vector` enabled on Synawood project only (never the private example).
- Tables (names may refine in #163): `asset_index_state`, `asset_shots`, `asset_tags`, `asset_embeddings` (vector columns), optional transcript text on index state or existing probe/JSON.
- Blob thumbs remain in Azure Blob; DB stores keys + metadata only (ADR-0009).

### 5. Studio Tools + HTTP

Tools (#168): `find_assets`, `list_assets_by_tag`, `describe_asset` (and later Director basket helpers #174).  
HTTP (#170): search / reindex / probe status routes under Studio product access.  
Cost (#175): caption + embed + transcribe go through estimate → confirm / caps like other generators.

### 6. Story Builder = Media bin mode

Not a new product surface (#171–#172):

- Toggle **Story Builder** on Media bin: semantic search, tag filters, shot navigator, asset preview modal.
- Selecting results can Place on timeline (ADR-0015) or add to a **Director basket** (#174) for a later `direct_project` / scene fill.

### 7. History / RLS

Index tables: RLS on; grants match other Studio metadata (**service_role** for workers; authenticated policies only if browser reads index — prefer server routes with `requireStudioAccess`). Tests in #177.

## Consequences

- #163 lands schema + pgvector before any UI.
- Suggestions (#ADR-0029) can start using `find_assets` after #168 without changing the suggest tool contract.
- Embedding model / dimensions pinned in #166 (document chosen dims in migration).
- Brand DNA / Campaign factory stay parked (separate epics).

## Rejected

- Project-only index (blocks “use last week’s funny take”).
- External vector DB for v1 (ops cost; local-first prefers Supabase).
- Auto face recognition / celebrity labeling (privacy + flag complexity).
- Replacing Media bin with a CapCut-style media cloud product.
