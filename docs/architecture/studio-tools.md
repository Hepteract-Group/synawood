# Studio Tools

Tools are the Studio Agent's hands. Each tool is a validated function: input schema → mutate or query Studio Project → structured result.

## v1 catalogue

| Tool | Purpose |
|---|---|
| `create_project` | New Studio Project from Brief / defaults |
| `get_project_summary` | Compact read for the model |
| `add_clip` | Place video/image/audio on a track |
| `trim_clip` | In/out points |
| `remove_clip` | Delete by id |
| `add_captions` | From transcript words or plain text |
| `set_hook_title` | Opening title card props |
| `set_end_card` | CTA / URL / logo end card |
| `import_product_brand` | Optional copy from Product Brand Library → `project.brand` |
| `set_model_profile` | Select Model Profile or override one role for subsequent jobs |
| `generate_image` | Image Generator via AI SDK + profile `image` model; BrandPromptContext + refs |
| `generate_video_clip` | Video via AI SDK `experimental_generateVideo` + profile `video` model; **text-to-video** and **image-to-video** are both first-class (ADR-0048). Pass N stills as `sourceImageAssetIds`; mentioned video clips as Seedance refs. Over the vendor cap (or a video on Veo) fails before spend. |
| `generate_voiceover` | Speech via profile `speech` / TTS; Brand kit `voice.json` |
| `transcribe_media` | Profile `transcribe` / Whisper → caption source |
| `list_marketing_skills` | Discover marketing skills available for this product |
| `load_marketing_skill` | Pull a skill body into context for this turn |
| `add_generated_asset` | Attach a ready Generation Job result to the project (if not auto-added) |
| `plan_slideshow` | Create/replace `slides[]` for carousel/slideshow presets |
| `set_slide` / `reorder_slides` | Edit one slide or order |
| `generate_slide_background` | Brand-bound image for one slide |
| `set_slideshow_voiceover` | VO from cues or attach asset |
| `set_campaign_brief` | Campaign Pack brief (prompt, aspect, refs) |
| `plan_campaign_creatives` | Outline `creatives[]` without spend |
| `draft_generation_plan` / `update_generation_plan` | Shot list, dialogue, models, £ — no Gateway generate (ADR-0086) |
| `apply_generation_plan` | After confirmSpend: run generate tools from the snapshot |
| `set_campaign_creative` | Patch one creative card |
| `generate_campaign_creatives` | Batch stills; `estimateOnly` / `confirmSpend` when £>0 |
| `set_hook_title` | Opening title — brand fonts/colors via composition props |
| `set_end_card` | CTA / URL / logo from Brand kit |
| `render_export` | Remotion Render Job; supports `targets: stills \| mp4 \| both` |

### Wave 2M — Authored compositions (ADR-0091)

| Tool | Purpose |
|---|---|
| `list_motion_kit` | Motion kit catalog (names, props, examples). No spend. |
| `write_composition` | Replace project `compositionSource`; `compositionId` becomes `authored`. Compiler runs. |
| `patch_composition` | Patch source; compiler runs. |
| `set_motion_seed` | New deterministic take of the same formula. No spend. |

Compile failures are tool errors (plain English + line). `inspect_preview` still required on make-ad turns. See [authored-compositions.md](./authored-compositions.md).

### Wave 2B — Ad Generator (ADR-0027 / plan 09)

| Tool | Purpose |
|---|---|
| `extract_brief` | Enqueue URL/PDF extract → `ExtractedBrief` |
| `apply_brief` | Brief → `project.brand` + first cut (`minimal` or `director`) |
| `plan_variants` | Build platform × hook × CTA plan + cost estimate |
| `render_variants` | Materialize child projects (shared assets) ± render jobs |
| `promote_variant_field` | Copy selected child fields back to parent |

### Wave 2A — Intent / Scenes (ADR-0026 / plan 08)

| Tool | Purpose |
|---|---|
| `set_intent` | Merge Intent patch onto `project.intent` (no silent timeline rebuild) |
| `plan_scenes` | Deterministic ScenePlan draft (no write until apply) |
| `apply_scene_plan` | Replace `project.scenes` from a plan |
| `add_scene` / `set_scene` / `remove_scene` / `reorder_scenes` | Scene CRUD |
| `assign_clip_to_scene` | Move a clip into a scene (or unassign); one scene per clip |
| `direct_project` | Preview-first DirectorPlan (dryRun default; reasoner + heuristic fallback) |
| `commit_director_plan` | Apply a draft DirectorPlan (optional cherry-pick excludes) |
| `suggest_for_clip` / `suggest_for_scene` | Executable contextual suggestions (heuristic + optional reasoner) |

HTTP surface for Intent / Scenes / Director (same tools): see [intent-and-scenes.md](./intent-and-scenes.md#http-routes-dashboard-142).

### Wave 2D — Version tree / named branches (ADR-0030 / plan 11)

| Tool | Purpose |
|---|---|
| `list_branches` | Named tips under this project (`main`, Funny, …) |
| `create_branch` | Fork active tip into a new named branch; optional `switchAfter` |
| `switch_branch` | Set active branch + mirror tip onto project row |
| `promote_branch` | Full-tip copy of a non-main branch onto `main` |
| `merge_branch` | v1 full-tip replace source → target (default `main`) |
| `save_director_plan_as_branch` | Commit a draft DirectorPlan, then fork the post-commit tip into a named branch |

HTTP (#185): see [version-tree.md](./version-tree.md#http-routes-185).

Branches ≠ variants (`plan_variants` / `promote_variant_field`).

### Wave 2H — Localization (ADR-0043 / plan 23)

| Tool | Purpose |
|---|---|
| `set_active_locale` | Snapshot current copy, apply stored (or default) locale strings |
| `translate_all_missing` | Fill empty `copy[locale]` from default; default also switches preview (`applyToPreview`). Stub prefixes `[fr]`; live needs `confirmSpend` |
| `dub_project_for_locale` | Fork named branch `locale-<code>`, **switch onto it** (leaves main), translate-missing. No lipsync. |
| `apply_locale_money` | ISO currency + minor units; optional CTA price append |

HTTP: `POST /api/studio/projects/[id]/locale` `{ action: set \| translate \| dub \| money }`.

Claim rules may set `locales[]` (empty = all). `VariantSpec.locale` is an optional matrix axis.

### Wave 2E — Style packs (ADR-0045 / plan 13)

| Tool | Purpose |
|---|---|
| `list_style_packs` | First-party Remotion looks (`cinematic-teal-orange`, `luxury-perfume`, `vhs`) |
| `set_style_pack` | Apply or clear `project.stylePackId`. No spend. |

HTTP: `GET`/`POST /api/studio/projects/[id]/style-pack`. Approve fails closed on unknown pack ids.

### Wave 2K — Overlay library (ADR-0057 / 0058 / 0059 / plan 27)

| Tool | Purpose |
|---|---|
| `add_text` | Place a text overlay (`title` / hook / lower third / CTA) with layout + style |
| `update_overlay` | Patch copy, timing, layout, style |
| `captions_from_transcript` | Build caption overlays from word timings (`confirmSpend` if transcribe £>0) |
| `place_sticker` | Overlay `kind: sticker` with `assetId` |
| `apply_filter` / `clear_filter` | Cut `stylePackId` or clip `filterId` + intensity |
| `apply_effect` / `clear_effect` | Clip treatment primitive (`shake`, `glow`, `flash`, `zoom_punch`) |
| `list_library` | First-party + product library items |
| `create_library_item` | Agent/founder author sticker, grade tokens, or treatment stack |
| `import_library_item` | PNG/WebP/SVG sticker or JSON grade/recipe; license unknown until founder checks |

HTTP: `GET`/`POST /api/studio/projects/[id]/overlays` (`action: add_text` or `update_overlay`). Bin drag and inspector edits hit the same mutations (ADR-0016). `.cube` LUT import is v1.1 (#720).

B-roll / PiP: `add_clip` with `trackId` `track_broll` (aliases `broll` / `pip`), then `set_pip_layout` for inset vs split (`side-by-side`, `news`, or `x/y/width/height` 0–1) — [ADR-0046](../adr/0046-broll-pip-track.md). HTTP: `GET`/`POST /api/studio/projects/[id]/pip-layout`.

### Wave 2E — Voice Studio (ADR-0033 / plan 14)

| Tool | Purpose |
|---|---|
| `synthesize_voice` | TTS onto the audio track with `probe.voiceProvenance`. `confirmSpend` when £>0. |
| `translate_and_dub` | TTS a target-locale line + `dub_jobs` row. Does not lip-sync. |
| `lipsync_clip` | Quality floor (video+audio, ≤15% drift). v1 is `mock-lipsync` (not Final-eligible). |
| `remove_fillers` | Build a cut list from transcript filler words. Does not edit the timeline. |
| `build_cut_list` | Propose um / pause / repeated-take / off-topic ranges (`startMs`/`endMs`/`reason`). Dry-run default. |
| `apply_cut_list` | Remove those ranges from the talking-head clip. Captions in the window move or drop with the picture. |

HTTP: `GET`/`POST /api/studio/projects/[id]/voice`. Profiles: `/api/products/[id]/voice/profiles`. Settings: `/settings/voice`. Distinct from `dub_project_for_locale` (copy/branch, no lipsync).

### Wave 2F — Creative structure (ADR-0034 / plan 15)

| Tool | Purpose |
|---|---|
| `derive_creative_structure` | Map Scenes onto hook/education/trust/offer/cta beats. No timeline rewrite. |
| `set_creative_structure` | Replace beats manually (`source: manual`). |

HTTP: `GET`/`POST /api/studio/projects/[id]/structure`. Approve copies beats onto `final_assets.creative_structure` (immutable). Empty beats nudge; they do not block.

### Wave 2I — Intelligent B-roll (ADR-0047 / ADR-0048 / plan 25)

| Tool | Purpose |
|---|---|
| `find_moments` | Shot-level retrieval (query / tag / scene role / transcript window). Not whole-file `find_assets`. |
| `place_shot` | Place a Moment on `track_broll` with trim from `asset_shots`. |
| `assemble_broll` | Draft `BrollPlan` (library Moments + generate-to-fill + music). `dryRun` default true. |
| `commit_broll_plan` | Apply the plan; replace existing B-roll in the scene window; enqueue video jobs. |

Live `generate_video_clip` stays the existing tool; ADR-0048 makes the adapter real and keeps it off `founder-edit`. Architecture: [broll-assembly.md](./broll-assembly.md).
B-roll / PiP: `add_clip` with `trackId` `track_broll` (aliases `broll` / `pip`), then `set_pip_layout` for inset vs split (`side-by-side`, `news`, or `x/y/width/height` 0–1) — [ADR-0046](../adr/0046-broll-pip-track.md). HTTP: `GET`/`POST /api/studio/projects/[id]/pip-layout`. `place_shot` trims an indexed Shot onto that lane (or A-roll if `trackId` omitted).

B-roll Moments: `find_moments` searches indexed `asset_shots` (tags + caption + **transcript windows** when timestamps exist, else excerpt; per-shot text embeddings; **visual shot embeddings** when present — ADR-0052). Empty index or missing embeddings → tag/caption fallback, not an error. [ADR-0047](../adr/0047-intelligent-broll-assembly.md). Follow with `place_shot`, or `assemble_broll` (dryRun default) → `commit_broll_plan`.

### Wave 2J — Analyze-on-index (ADR-0053)

| Tool | Purpose |
|---|---|
| `analyze_asset` | Prompt + JSON schema over an asset or Shot window. Writes `asset_analyses`. Spend-gated. |

Schema packs (not extra ingest pipelines): `segment`, `compliance`, `highlight`, `custom`. HTTP: `POST`/`GET /api/studio/assets/[assetId]/analyze`. Library Analyze does not replace cut review: still call `inspect_preview` before finishing a make-video turn. `analyze_asset` never marks cut review passed.

### Wave 2L — Editor-agent polish (ADR-0070–0077)

Target tools — not shipped until their issues land. Index: [editor-agent-polish.md](./editor-agent-polish.md).

| Tool | Purpose |
|---|---|
| `build_cut_list` | Propose um / pause / repeated-take / off-topic ranges. Dry-run default. **Shipped in #871.** |
| `apply_cut_list` | Remove those ranges (existing; now accepts the four reasons). **Shipped in #871.** |
| `edit_for_clarity` | Clarity wrapper; confirm if a large share of duration is removed. |
| `enhance_speech` | Noise/echo on clip audio. Generation Job. |
| `duck_music` | Music down under speech. |
| `place_sfx` | Whoosh / hit on the Sounds lane at a time. **Shipped in #885.** |
| `apply_motion_preset` | Named treatment via existing `apply_effect` (`hook_punch`, `cta_hit`). |
| `apply_jump_cut_zooms` | `zoom_punch` on cut-list splices. |
| `reframe_clip` | Subject-tracking pan/scan to a target aspect. Job. |
| `set_caption_style` | Karaoke / highlight / emoji. |
| `regen_effect` | Re-run one treatment / overlay / SFX / B-roll window. |
| `generate_thumbnail` | Review / Work board only — **not** required to finish an agent turn. |

Chat grounding (`@t:`, `@clip:`, `@overlay:`, `@region:`) is turn context, not a tool ([ADR-0072](../adr/0072-chat-grounding.md)). Why-log is persisted project data ([ADR-0076](../adr/0076-why-log-and-targeted-regen.md)).

## Contracts

- **Idempotency where cheap** — prefer clip ids returned to the model; do not invent paths.
- **No silent disk writes outside project store + asset store.**
- **Human-readable errors** — “Clip `c_12` not found”, not stack traces to the model.
- **Same names/schemas** will be reused for **outbound** MCP ([mcp-surface.md](./mcp-surface.md)). Inbound MCP tools are extra catalog rows, not a second schema language ([ADR-0081](../adr/0081-inbound-mcp-tools.md)).


## Generation vs render

- `generate_*` → **Generation Job** → new asset in the store.
- `render_export` → **Render Job** → composed MP4/PNG from the whole Studio Project.
- Do not conflate “AI made a clip” with “Final asset is ready.”

## Non-tools (v1)

- Freeform “run shell”
- Unsandboxed `eval` of model TSX in the dashboard origin or render worker (authored TSX goes through `write_composition` + sandbox — ADR-0091)
- Direct Postiz calls from the Studio Agent (use Work board Schedule → `core/channels` adapter; ADR-0065)
- Paid ad account APIs
- Calling provider SDKs from the UI (must go through tools/adapters)
- Writing Final binaries only to git (Blob + DB required)
- Arbitrary HTTP webhooks as Studio Tools (inbound MCP instead — [ADR-0081](../adr/0081-inbound-mcp-tools.md))

