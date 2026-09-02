# ADR-0084 — Gateway model families: adapter, live smoke, then picker

**Status:** accepted  
**Date:** 2026-08-25  
**Issue:** Epic [#1003](https://github.com/Hepteract-Group/marketing-os/issues/1003) · land docs [#1004](https://github.com/Hepteract-Group/marketing-os/issues/1004) · Wan 3.0 [#1006](https://github.com/Hepteract-Group/marketing-os/issues/1006)  
**Amends:** [ADR-0007](./0007-model-profiles.md) (curated profiles stay; we add **family adapters** and an add-model rule). [ADR-0048](./0048-live-video-clip-generator.md) (do not cap a 30s family at Veo’s 8s; do not assume Seedance token syntax for every live id).  
**Does not supersede:** ADR-0007 (never dump the full Gateway catalog into the picker). ADR-0051 (picker lists model names, not internal profile ids). ADR-0055 (no silent reasoner swap).  
**Related:** [ADR-0085](./0085-catalog-freeze-and-remap.md), [ADR-0086](./0086-generation-plan-and-artefacts.md), [ADR-0093](./0093-minimax-h3-video-family.md) (MiniMax H3 / H3 Max)  
**Docs:** [architecture/gateway-catalog.md](../architecture/gateway-catalog.md), [architecture/video-generation.md](../architecture/video-generation.md), [ux/model-catalogue.md](../ux/model-catalogue.md), [ui/model-catalogue.md](../ui/model-catalogue.md)

## Context

Vercel AI Gateway lists dozens of video, image, and language models behind one key. Studio already calls Gateway with string ids (`experimental_generateVideo`, `generateImage`, `generateText`). The picker is a **curated** allowlist (7 reasoners, 5 image, 4 video as of 2026-08-25).

Dumping the catalog into Send was rejected in ADR-0007. The remaining product need is: **support as many models as we can write a real adapter for**, starting with **Wan 3.0** (`alibaba/wan-v3.0-video`, listed on Gateway 2026-08-25). Today every live video id is treated as Veo-or-Seedance-shaped (duration snap, stills caps, `[Image n]` tokens). Adding a Wan 3 string without a family adapter would spend credits on a mis-shaped request.

Two adapter layers exist. We do **not** wait for Vercel to write our product adapter when Gateway already lists the id.

## Decision

### 1. Two layers

| Layer | Owner | Job |
|---|---|---|
| Wire / Gateway | Vercel | Route `creator/model` to a provider, bill, retry. `experimental_generateVideo` / `generateImage`. |
| **Family adapter** | Us | Duration snap, stills/video-ref caps, prompt token syntax, SDK field mapping (`prompt` vs `{ image, text }` vs `frameImages` vs `inputReferences`), brand block, preflight **before** spend, £ estimate, QC, Generation Job snapshot. |

If live smoke proves Gateway cannot take t2v/i2v for that id at all, file upstream and **do not** ship a picker row. We still write our adapter so we never send a Veo-shaped body to Wan.

### 2. Add-model flow (every new id)

1. **Family adapter** in-repo (isolated module; see §3).
2. **Live smoke** on localhost with `AI_GATEWAY_API_KEY` (one real call, spend approved). Pass = usable bytes + duration. Fail = no picker.
3. **Picker + catalogue** row. Live/Frozen from ADR-0085.

Never: append an id to `GATEWAY_VIDEO_MODELS` / `GATEWAY_IMAGE_MODELS` / `GATEWAY_REASONER_MODELS` and hope.

### 3. Families, not 34 copies and not one `if (seedance)` tower

Shared: blob upload, QC, Generation Jobs, confirmSpend, freeze check.

**Per family** (own module for caps, tokens, field mapping):

| Family | First ids | Notes |
|---|---|---|
| Veo | `google/veo-3.1-fast-generate-001`, `google/veo-3.1-generate-001` | 4/6/8s, 1 still, 0 video refs |
| Seedance 2.x | `bytedance/seedance-2.0-fast`, `bytedance/seedance-2.5` | `[Image n]` / `[Video n]`, long stills lists |
| **Wan 3 all-in-one** | `alibaba/wan-v3.0-video` | Bare prompt = t2v; start image = i2v; refs = r2v. Tokens `character1`. Not the Alibaba-direct id `wan3.0-video`. Audio-in / doc-in **out of v1** unless smoke proves Gateway fields exist |
| **MiniMax H3** | `minimax/minimax-h3`, `minimax/minimax-h3-max` | Isolated family ([ADR-0093](./0093-minimax-h3-video-family.md)). H3: 4–15s, 2K, refs. H3 Max: 5–15s, 480p/768p, t2v+i2v. **Not** `minimax/minimax-m3` (reasoner). |
| Wan 2.6/2.7 suffix SKUs | later | Separate from Wan 3 — suffix is the mode |
| Kling t2v / i2v / motion-control | later | Split SKUs; i2v-only must fail closed with no still |
| Grok Imagine Video | later | `<IMAGE_n>` tokens |

A Veo duration change edits the Veo module only.

### 4. Never dump the catalog

Picker stays curated. Catalogue page (UX/UI) explains **supported** rows only. Optional later: Advanced search over `tool-use` language models still goes through the reasoner allowlist, not raw `/v1/models`.

### 5. Wan 3.0 is the first new family; MiniMax H3 is the next

First implementation after freeze/remap (ADR-0085) may run in parallel: Wan 3 adapter → local t2v smoke → i2v smoke → picker/catalogue. r2v if `inputReferences` work. Do not block t2v on Alibaba invitational extras (docs-as-input).

MiniMax H3 / H3 Max follow the same flow in the same founder smoke ([ADR-0093](./0093-minimax-h3-video-family.md), [#1070](https://github.com/Hepteract-Group/marketing-os/issues/1070)). `minimax/minimax-m3` stays a reasoner.

## Consequences

- `core/creative` video path splits family modules; prefix heuristics (`id.startsWith('bytedance/seedance')`) stop being the only branch.
- Tests: one fixture per family (duration, stills, tokens). Wan 3 must not emit Seedance `[Image n]`.
- Catalogue copy: “Wan 3.0 — same character/product in a new scene; longer than Veo.”

## Rejected

- Loading every Gateway video/image/language id into Send.
- Waiting for a new Vercel “Wan 3 Gateway adapter” before we write ours, when the id is already listed.
- One shared adapter with a growing `if` chain.
- Shipping Wan 3 as `wan3.0-video` (wrong id for Gateway).
