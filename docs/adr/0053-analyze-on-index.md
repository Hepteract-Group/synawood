# ADR-0053 — Analyze-on-index (one schema seam, many workflows)

**Status:** accepted  
**Date:** 2026-08-20  
**Wave:** Vision **2J** · Plan index **26** · Epic [#579](https://github.com/Hepteract-Group/marketing-os/issues/579)  
**Related:** ADR-0001 (harness), ADR-0008 (marketing skills), ADR-0018 (spend), ADR-0032 (index), ADR-0044 (DNA / catalog), ADR-0047 (library-first), ADR-0051 (cut review), ADR-0052 (visual shots)  
**Does not supersede:** ADR-0001, ADR-0032, ADR-0051, ADR-0052.  
**Amends:** ADR-0032 — the index is the intelligence layer for **search, segmentation, compliance, highlights, and reasoning**, not retrieval-only.

## Context

Twelve Labs runs search, segmentation, compliance, highlight generation, and reasoning against one Index because **workflows are prompts/schemas**, not pipelines. Marengo retrieves; Pegasus generates structured text over the same video identity.

We already have the Index (ADR-0032) and the retriever (ADR-0052). We do not have a Pegasus analogue: every new job (compliance, chapters, highlights) would otherwise spawn its own ingest. That is how the layer fragments.

Cut review (`inspect_preview`, ADR-0051) watches **this** project’s player. Analyze-on-index watches **library** assets (and optional windows). Both are VLM passes. They are not the same tool.

## Decision

### 1. One tool, one table, no second index

Studio Tool **`analyze_asset`**:

- Input: `assetId`, optional `shotId` or `startMs`/`endMs`, `prompt`, JSON **schema**, `confirmSpend` when £>0.
- Behaviour: gather frames (shot thumbs / extracted window) + transcript excerpt for that window; call the profile **caption** (vision) role with the schema; return timestamped structured JSON.
- Persist: rows in **`asset_analyses`**: `asset_id`, `product_id`, optional `shot_id`, `kind` (`segment` | `compliance` | `highlight` | `custom`), `schema_id`, `result` jsonb, `model_id`, cost attribution. Re-runs replace by `(asset_id, kind, schema_id)` unless the caller asks to keep history.

Search does not read a new vector DB. Segmentation does not write a parallel shot table as source of truth. Compliance does not re-download the file into a sidecar store.

HTTP mirrors the tool for the dashboard (same auth as other Studio asset routes).

### 2. Workflows are schemas, not products

| Workflow | What the schema asks for | What the agent does with the JSON |
|---|---|---|
| **Search** | (not Analyze — ADR-0052 retrieve) | `find_moments` / `find_assets` |
| **Segmentation** | Editorial / event bounds + labels | Upsert `asset_shots` (see §3) |
| **Compliance** | Hits against catalog / DNA / `claim-vs-catalog` (+ product overlay) | Tags + blocking notes; agent must not place a failing Shot as proof |
| **Highlights** | Ranked windows worth placing | Moments → existing `place_shot` / assemble (ADR-0047). No highlight-reel product. |
| **Reasoning** | Q&A or extract over a window | Studio Agent + cut review. `analyze_asset` is extra eyes on **library** footage; `inspect_preview` remains required on the **cut**. |

Do not ship five tools that each ingest video. Ship schema packs (marketing skills and/or committed JSON schemas under `core/creative`) that `analyze_asset` runs.

### 3. Semantic shots may replace heuristic bounds — never silently rewrite placed clips

Heuristic ~4s windows (Wave 2C) stay the default until a confirmed Analyze segment pass runs.

When segmentation JSON lands:

- New / moved bounds write new `asset_shots` (thumbs + embeddings re-run for those rows).
- Timeline clips already placed keep their **trim times** (start/end on the source file). Do not retarget a clip to a different window because shot ordinals changed.
- Reindex that rebuilds shots must not break Approve-ready cuts. Clip.assetId + source in/out remain canonical.

### 4. Compliance is visual + copy, same rules file

Text claims already lint via `claim-vs-catalog` (and product overlays). Visual compliance is the same rules pointed at **frames + on-screen text + spoken excerpt**:

- Forbidden claims appearing as captions or UI chrome.
- Competitor / off-brand logos when the catalog names them.
- Unsafe / off-ICP visuals the overlay lists.

It is not a CCTV product. It does not block Approve by itself in v1 (same spirit as empty creative-structure nudge, ADR-0034). The agent must surface failures in chat and must not treat a failing Shot as “the proof beat.” Founder can still Approve (ADR-0010 human gate).

### 5. Same harness, same spend model

One Studio Agent (ADR-0001). Analyze is allowlisted like other paid tools. Estimate → confirm / caps. `ci-stub` returns fixture JSON. No LangGraph, no Twelve Labs Analyze API as the runtime.

Frames come from **our** Blob thumbs / extract — not a vendor index.

### 6. Query engine = Studio Tools

There is no separate “intelligence API” product. Chat, Story Builder, assemble, compliance UI, and cut review all call the same tools / HTTP. MCP later (epic #20 remainder) exposes the same functions.

## Rejected

- A second index, graph database, or vendor Index for Analyze.
- One ingest pipeline per workflow.
- Replacing ADR-0051 cut review with library Analyze (“we analysed the take, so the player is fine”).
- Auto-failing Approve on visual compliance in v1.
- Teaching customers “B-roll,” “highlight reel,” or “compliance suite” as modes.
- Buying Pegasus and treating Synawood as a thin client of Twelve Labs.

## Consequences

- Plan **26** / epic [#579](https://github.com/Hepteract-Group/marketing-os/issues/579) sequences: thumbs (ADR-0052) → `analyze_asset` → segment / compliance / highlights / critic wiring.
- Brand DNA / Catalog (ADR-0044, epic #97) supply the compliance rule objects; Analyze does not invent claims.
- CONTEXT: **analyze-on-index**, **visual compliance check**, **highlight Moment** (ranked Moment, not a new editor).
- Architecture: `docs/architecture/asset-intelligence.md` (index + analyze consumers). Studio Tools catalogue gains `analyze_asset`.
