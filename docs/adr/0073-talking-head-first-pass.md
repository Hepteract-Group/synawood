# ADR-0073 — Talking-head first pass (agent policy, not a recipe)

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Related:** [ADR-0049](./0049-direct-branded-ad.md), [ADR-0051](./0051-agent-watches-the-player.md), [ADR-0041](./0041-music-generation.md), [ADR-0057](./0057-overlay-library-text-captions-stickers.md), [ADR-0071](./0071-transcript-as-timeline.md)  
**Does not supersede:** ADR-0049 / 0051. No customer-facing recipe or “Quick Design” button that bypasses the agent.

## Context

OpusClip AI Producer runs one pass on a talking-head take: captions, motion, music, SFX, filler/dead air, edit log. Descript “Quick Design” is a named one-click polish. We already have the pieces (Director, `apply_brief`, fillers, captions, music, `zoom_punch`, critic). They are not **one agent policy**, so a marketing-team take still sounds amateur: noise, music fighting speech, jump cuts, captions without motion.

Founder: do **not** add a second named customer recipe.

## Decision

### 1. Policy, not a product mode

When the operator asks to make / polish a talking-head ad (or attaches a take and says make an ad), the Studio Agent **must** attempt this pass before it can finish (same spirit as ADR-0051 — it cannot skip the critic):

1. **Speech enhance** if the take is noisy (tool; skip if already enhanced).
2. **Cut list** — fillers, pauses, retakes ([ADR-0071](./0071-transcript-as-timeline.md)). Clarity only if the brief is clearly violated.
3. **Jump-cut zooms** — apply `zoom_punch` (or a small zoom preset) on those cuts so the splice does not flash. Policy on existing `apply_effect`, not a new editor.
4. **Captions** from transcript, word-timed style ([ADR-0075](./0075-word-timed-captions.md)).
5. **Music** if missing (ADR-0049) + **duck** under speech.
6. **SFX + motion** from a **small first-party pack**. Not a DAW. Not stock GIFs.
   - **SFX:** `place_sfx` (whoosh on hook, hit on CTA) — new audio on the SFX lane.
   - **Motion:** existing `apply_effect` primitives only (`zoom_punch`, `flash`, `glow`, `shake`). First pass may call `apply_motion_preset` with pack ids `hook_punch` / `cta_hit` (thin wrapper, no new Remotion effects). Jump-cut zooms stay `apply_jump_cut_zooms`.
7. **Brand chrome** (Path C / kit) if missing.
8. **`inspect_preview`** required. Then narrate + why-log ([ADR-0076](./0076-why-log-and-targeted-regen.md)).

If a step does not apply (no speech, already ducked), skip it and say so in the why-log. Do not block the pass because SFX is empty.

### 2. New / generalized tools

| Tool | Purpose |
|---|---|
| `enhance_speech` | Noise/echo reduction on a clip’s audio → new asset, swap on the clip. Generation Job. `confirmSpend` if £>0. |
| `duck_music` | Sidechain-style envelope: music down under speech ranges. Deterministic; no model required. |
| `place_sfx` | Place a pack item on the audio/SFX lane at a time. |
| `apply_motion_preset` | Named first-party treatment (`hook_punch`, `cta_hit`) via existing `apply_effect`. No new primitives. |
| `apply_jump_cut_zooms` | For each applied cut-list splice, `apply_effect` zoom on the outgoing or incoming clip. Idempotent. |

Enhance is async. Duck and zooms are fast mutations.

### 3. UX-first

The operator sees the **same Studio Agent chat**, not a “Producer” or “Quick Design” tab. Long steps (enhance, transcribe): **modal + persistent banner**; reload polls. They must not learn status from the Send button. If the worker is down in local dev, say so on the banner (existing generation-job pattern).

### 4. What this pass is not

Not a clipping mill. Not Recreate. Not avatars / eye contact / green screen. Not in-agent post. Not a customer-visible spend profile.

## Consequences

- Harness system prompt / marketing skill encodes this order. Tools stay individually callable (“just duck the music”).
- First-party SFX pack lives in-repo like stickers (ADR-0057). Licensed. No GIPHY.
- Skin smoothing / background blur stay vetoed.

## Rejected

- A named “AI Producer” or “Quick Design” mode in the UI.
- Generating a fake presenter when the take is noisy (enhance or re-record).
- Auto-post after the pass.
