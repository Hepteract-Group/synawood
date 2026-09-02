# ADR-0026 — Intent object and Scene tree on Studio Project

**Status:** accepted  
**Date:** 2026-08-03  
**Wave:** Vision 2A · Plan index **08** · Epic [#135](https://github.com/Hepteract-Group/marketing-os/issues/135)  
**Relates to:** ADR-0001 (Studio Agent harness), ADR-0003 (Project JSON source of truth), ADR-0014 (Dynamic project duration), ADR-0016 (Studio editor chrome), ADR-0018 (trust / spend UX)  
**Consumed by:** ADR-0027 (`apply_brief` director mode), ADR-0029 (AI Director)  
**Extends:** `docs/architecture/timeline-model.md`  
**Note:** Number **0026** is Intent/Scenes. ADR-0025 remains per-project brand. An earlier draft briefly used 0025 for Intent before brand claimed that number.

## Context

Today a Studio Project is *clips + overlays on tracks*. The founder's intent lives implicitly in chat history and the `product-marketing.md` excerpt in the system prompt. Two problems:

1. **Intent is not editable.** Founder can't say "make this a 15s TikTok ad for parents, emotion emotional, CTA download today" as a first-class artifact and have it drive regeneration. It leaks into ad-hoc chat.
2. **Structure is not semantic.** We have compositions with clip lists. We do not know which clip is the **Hook**, which is the **CTA**. Without that, we can't rebalance the edit when Intent changes, we can't answer performance questions later ("which hooks work best?"), and we can't ship the AI Director (ADR-0029).

The vision (`thought_dumps/vision.md` — Intent Layer, Scenes) requires both. Every downstream Vision wave depends on them.

## Decision

1. **Persist `intent` on Studio Project JSON** (`project.intent`). A structured `Intent` object with optional fields: `goal`, `audience`, `platform`, `emotion`, `lengthSeconds`, `cta`, `brandVoice`, `keywords`. All fields optional individually; the object defaults to `{}` when absent. Founder fills it via a dedicated Intent panel; the Studio Agent may propose values via `set_intent` (#137).

2. **Persist `scenes` on Studio Project JSON** (`project.scenes`). An ordered array of `Scene` objects, each with `id`, `role` (`hook | problem | context | proof | solution | offer | cta | custom`), `label`, optional `intentNote`, optional `targetDurationFrames`, `clipIds[]`, optional `overlayIds[]`, `locked`. Scenes are the semantic layer over the existing timeline; clips remain in `clips[]` / `tracks[]`. A `clipId` belongs to at most one scene.

3. **No new Supabase columns for Intent/Scenes in v1.** ADR-0003 keeps the document as the write model. Optional future jsonb columns may mirror for SQL analytics (Wave 2F) behind a later ADR — not required for Wave 2A tools/UI.

4. **Scenes are optional at rest, first-class in UI.** Existing projects load with `scenes: []`. When empty, the Scene strip shows an "Add scenes" affordance and a one-click "Infer from project" action. New projects created via Ad Generator or via the AI Director's `plan_scenes` should come with scenes populated when those paths are wired.

5. **Regeneration is diff-based, not implicit.** Changing `intent.emotion` from `exciting → emotional` does **not** silently rebuild. It fires `intent_changed` in the Studio Agent turn; the AI Director tool (ADR-0029) drafts a `DirectorPlan` which the founder previews and applies. Never mutate the project behind the founder's back on intent edits.

6. **Composition binding unchanged.** `compositionId` still selects a Remotion composition. Scenes are a layer above compositions; Remotion does not need to know about scenes to render (v1).

## Consequences

- Zod schemas for `Intent` and `Scene` in `core/creative/src/intent/`; `studioProjectSchema` gains `intent` + `scenes` with empty defaults.
- New Studio Tools (later slices): `set_intent`, `set_scene`, `add_scene`, `remove_scene`, `reorder_scenes`, `plan_scenes`, `assign_clip_to_scene`.
- System prompt gains a compact Intent + scene-role summary (#138).
- Downstream ADR-0027 Ad Generator and ADR-0029 Director consume Intent + scenes.
- UI: Intent panel + Scene strip — `docs/ux/intent-panel.md`.

## Rejected alternatives

- **Store intent as free text in chat.** Not queryable, not diffable, breaks Director and future performance graph.
- **Dedicated jsonb columns as the only store (v1).** Extra migration + dual-write without a reader that needs SQL filters yet; project JSON is enough (founder choice for #136).
- **Make scenes the source of truth and derive `clips[]`.** Too invasive for v1.
- **Trigger auto-regen on intent change.** Violates ADR-0018 and would cost real money silently.

## Open questions (not blocking)

- Per-scene compositions vs monolithic composition — later ADR.
- Multi-track scene chrome grouping — Scene strip UX.
