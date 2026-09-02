# ADR-0058 — Filters (grades) and Effects (treatments)

**Status:** accepted  
**Date:** 2026-08-22  
**Wave:** Vision **2K** · Plan index **27** · Epic [#692](https://github.com/Hepteract-Group/marketing-os/issues/692)  
**Amends:** [ADR-0045](./0045-effects-style-packs.md) §4 (which tab owns looks)  
**Related:** ADR-0002 (Remotion), ADR-0016 (Filters + Effects tabs), ADR-0045 (style packs), ADR-0057 (overlays), ADR-0059 (author + import)  
**Does not supersede:** ADR-0045 pack JSON, `StylePackProvider`, license gate, or `project.stylePackId`.

## The product

Founders say “make this clip warmer,” “VHS the whole ad,” or “punch in on the hook.” Those are **two different things**:

| Bin tab | Domain name | What it does | Scope |
|---|---|---|---|
| **Filters** | **Grade** / look | Color: contrast, saturate, hue, vignette, optional LUT | Whole cut **or** one clip |
| **Effects** | **Treatment** | Time-based motion on a clip: shake, glow, flash, zoom-punch | Clip (or a range on that clip) |

ADR-0045 shipped **three first-party looks** and put the picker on **Effects**. That tab is now overloaded. This ADR splits the IA so both founder and agent can apply a look **to the media on the timeline**, not only as a project-wide tint.

## Decision

### 1. Filters own grades; Effects own treatments

- **Filters tab** lists grades: the ADR-0045 packs (`cinematic-teal-orange`, `luxury-perfume`, `vhs`) plus later library grades (ADR-0059).
- **Effects tab** lists **treatments** (first-party primitives below), not the grade picker.
- A one-line note on Effects: “Looks (VHS, teal) live under Filters.” Existing `set_style_pack` HTTP stays; the bin calls it from **Filters** for whole-cut apply.

### 2. Whole-cut vs clip

- **Whole cut:** `project.stylePackId` (ADR-0045). Filters → “Apply to cut.” Remotion still wraps the composition in `StylePackProvider`.
- **Clip:** optional `clip.filterId` + `clip.filterIntensity` (0–1, default 1). Remotion wraps **that clip’s Sequence**, not the whole tree. Clip filter **overrides** the project pack on those frames (does not multiply two LUTs).

Agent tools: `set_style_pack` (cut), `apply_filter` `{ clipId, filterId, intensity }`, `clear_filter` `{ clipId }`.

If no clip is selected, Filters apply to the **cut**. If a clip is selected, they apply to that clip. The bin must show which (persistent label, not a tooltip-only).

### 3. Treatments are an allowlisted recipe, not shaders

`clip.treatments: Array<{ id, intensity, from?: number, durationInFrames?: number }>`

v1 primitive `id`s (first-party, in-repo):

- `shake` — camera shake, intensity = amplitude
- `glow` — bloom on highlights
- `flash` — white flash at clip in
- `zoom_punch` — scale 1 → 1.08 over the first 12 frames

No founder-written GLSL. No After Effects graph. Agent **compose** primitives (ADR-0059); it does not invent new primitives without a new ADR.

Effects tab: one card per primitive. Click/drag onto the **selected clip** (or the clip under the playhead). Intensity slider in the inspector.

Tool: `apply_effect` `{ clipId, effectId, intensity }`, `clear_effect` `{ clipId, effectId }`.

Treatments must not hide Path C logo or captions (same rule as style packs).

### 4. Transitions are not Effects-tab primitives

Clip-to-clip transitions (crossfade, whip) are **not** ADR-0058 treatments. Do not sneak them in as `apply_effect`. **Amended by [ADR-0091](./0091-empowered-agent-authored-compositions.md):** transitions **are** in-scope on authored compositions (`TransitionSeries`) and may join clips when that serves the ad. That is Wave **2M**, not this Effects tab.

### 5. Approve

- Unknown `filterId` / treatment `id` → fail closed (same spirit as unknown style pack).
- Library grades that are not `first-party` need a cleared license row (ADR-0045 §5, ADR-0059).
- Treatments are first-party primitives → always cleared.

### 6. Cut review

Filters/treatments change what the player shows. They **dirty** the cut-review fingerprint (already includes clips). Agent must inspect after a grade/treatment pass if the turn was a make-ad (ADR-0051).

## Rejected

- Keeping grades only on Effects (tab would lie).
- Binary LUT as the *only* grade format in v1 (JSON tokens stay; `.cube` import is ADR-0059 v1.1 / #720).
- Per-pixel keyframes for every treatment.
- “Filter” as a synonym for “blur the face” — that is a treatment or a future privacy tool, not a grade.

## Consequences

- Move the current Effects pack list UI to Filters; keep POST `/style-pack` for cut-level.
- Extend `clipSchema` with `filterId`, `filterIntensity`, `treatments`.
- Remotion: per-clip grade wrapper + treatment wrappers.
- Director free-text (`vhs`, `teal`) still maps to a **filter/pack id**; punch/shake maps to a treatment.
