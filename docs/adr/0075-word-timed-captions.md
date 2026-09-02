# ADR-0075 — Word-timed captions, emoji, and highlights

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Amends:** [ADR-0057](./0057-overlay-library-text-captions-stickers.md) §4 (karaoke “may” later → **now**; auto emoji + keyword highlight **now**)  
**Related:** [ADR-0006](./0006-brand-bound-generation.md) / [0025](./0025-per-project-brand.md) (type inherits Brand kit), [ADR-0071](./0071-transcript-as-timeline.md), [ADR-0073](./0073-talking-head-first-pass.md)  
**Founder override:** competitive row “Auto emoji + word highlights” was Later; **Veto → Add**.

## Context

ADR-0057 shipped caption overlays from transcript and allowed a word-highlight preset “if it stays data.” Karaoke/word-by-word was optional later. Short ads without readable **motion type** look unfinished. OpusClip’s script: auto emoji + color on keywords. Founder wants that in the first-pass, not a later style pack.

## Decision

### 1. Caption style presets (data, not a new editor)

Caption overlays already may carry word timings. v1 presets:

| Preset | Behaviour |
|---|---|
| `band` | Existing static / two-line band. |
| `karaoke` | Active word scales/pops using word timings. |
| `highlight` | Keyword spans (nouns / brief terms / operator-selected) get fill/stroke from Brand kit. |
| `emoji` | Optional emoji **after** a keyword, from a **licensed first-party set** (same rule as stickers — no random emoji font we do not license). |

Presets compose: karaoke + highlight + emoji is valid. Missing word timings → fall back to `band` and say so in chat.

### 2. Auto vs operator

First pass ([ADR-0073](./0073-talking-head-first-pass.md)) applies `karaoke` + auto highlight + auto emoji **on talking-head ads**. Operator can clear emoji, pin highlights, or switch to `band` in the inspector / Captions tab. Agent tools: `set_caption_style`, existing `captions_from_transcript` / `update_overlay`.

Auto emoji is **sparse** (a few marks per 30s, on hook/offer words). Not a sticker explosion. Claim scan (ADR-0042) still reads `overlay.text` (emoji do not count as claims).

### 3. Remotion

Word-timed presets are Remotion data (word array + style id). No free HTML. Path C logo stays above captions.

### 4. UX-first

Changing style is **visible on the player immediately** (preview). Building captions from transcript stays modal + banner if transcription is running. Do not hide karaoke behind a disabled “Captions later” tab.

## Consequences

- Overlay schema: `style.presetId` includes `karaoke` / `highlight` / `emoji` flags or a single preset id plus `emphasis[]` / `emoji[]` arrays keyed by word index.
- First-party emoji/sticker overlap: prefer the sticker pack codepoints we already license; do not add a second unlicensed set.

## Rejected

- Stock GIF caption packs (GIPHY).
- A second captions product (sidecar SRT as the editor). Burn-in remains v1; SRT export may still come later as an option.
- Particle / Lottie karaoke as v1.
