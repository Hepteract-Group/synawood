# ADR-0086 — Generation Plan and Artefacts pane

**Status:** accepted  
**Date:** 2026-08-25  
**Issue:** Epic [#1003](https://github.com/Hepteract-Group/marketing-os/issues/1003) · land docs [#1004](https://github.com/Hepteract-Group/marketing-os/issues/1004) · Generation Plan [#1008](https://github.com/Hepteract-Group/marketing-os/issues/1008) · Artefacts [#1009](https://github.com/Hepteract-Group/marketing-os/issues/1009)  
**Amends:** [ADR-0055](./0055-reasoner-must-generate.md) (make-an-ad must generate **after** the operator Applies a Generation Plan when Plan mode applies — not skip the plan, not skip generate).  
**Does not supersede:** [ADR-0003](./0003-project-json-source-of-truth.md) (plan is data on the Studio Project, not a disk of files). [ADR-0029](./0029-ai-director-and-contextual-suggestions.md) (DirectorPlan remains the **edit-diff** on an existing timeline). [ADR-0080](./0080-installable-studio-skills.md) (skills stay markdown craft; no `scripts/` on hosted SaaS).  
**Related:** ADR-0018 (loud failures, persist across reload), ADR-0026 (Intent / scenes), ADR-0082 (confirmSpend debits the plan total)  
**Docs:** [architecture/generation-plan.md](../architecture/generation-plan.md), [ux/generation-plan.md](../ux/generation-plan.md), [ux/artefacts.md](../ux/artefacts.md), [ui/generation-plan.md](../ui/generation-plan.md), [ui/artefacts-pane.md](../ui/artefacts-pane.md)

## Context

Paid video is often £0.50–several £ per clip. Chat that jumps to Veo is how people burn credits. Operators asked for a **visible, editable plan** (tone, angles, scene descriptions, spoken lines, models, £) **before** generate, and a place to see installed skills — like a Cursor file tree, but **not** a writable filesystem.

DirectorPlan (ADR-0029) is the wrong object: it is mutations to clips that already exist. Intent / scenes / extracted brief already capture why and story beats. The gap is **what we will spend to create**.

A general filesystem next to the project would duplicate ADR-0003, hide `.sh` / `.js` beside `plan.md`, and is not what Remotion/Approve consume. Pack safety already forbids executables (ADR-0039 / 0080).

## Decision

### 1. Generation Plan is a first-class document on the Studio Project

Zod schema on project JSON (ADR-0003). Markdown in the UI is a **view**, not the source of truth.

Sections (normative names):

| Section | Content |
|---|---|
| Goal / angle | One sentence; may copy Intent |
| Tone / emotion | Closed set + optional note |
| Audience | From Intent when set |
| Runtime | Target seconds, platform |
| Scenes[] | Role, description, duration, **dialogue** (VO / talking-head lines), on-screen text |
| Assets | Brand stills / refs to use |
| Models | Reason / image / video ids (canonical, ADR-0085) |
| Cost | Per-clip £ + total |

Spoken lines are **dialogue** or **voiceover** in the UI. Do not call them “script” (read as code).

Status: `draft` → `ready` (operator edited / accepted) → `applied` (confirmSpend + generate started) | `stale` (project revision moved).

### 2. Plan before paid generate (Plan mode)

When the operator asks to make an ad / generate video or a batch of stills with estimated £ > 0:

1. Agent writes/updates the Generation Plan via tools. **No** Gateway video/image yet.
2. **Plan panel** (cannot miss — modal + persistent banner if dismissed). Operator edits fields.
3. Confirm spend on the **plan total** (ADR-0082 wallet when hosted).
4. Apply → generate tools run against that snapshot. Jobs record plan id + canonical model ids.

ADR-0055: after Apply, a make-an-ad turn with video enabled and remaining duration still **must** call `generate_video_clip` (or fail visibly). “Here is the plan” with no Apply is not success. Apply without generate is the ADR-0055 failure.

Edit-only / video off: no Generation Plan required.

DirectorPlan stays for “make this feel premium” on an existing cut.

### 3. Artefacts pane, not a filesystem

A Studio region (see UI) that **looks** like a short tree:

- Generation Plan (editable structured fields; optional markdown preview)
- Installed skills (read-only `SKILL.md`; enable/disable remains Settings per ADR-0080)
- Optional read-only brand excerpts already on the project

The agent does **not** `writeFile` arbitrary paths. No `.sh`, `.js`, `.ts`, `.py`, `.wasm`, `node_modules`, pack `scripts/`. Reuse `checkPackArchivePaths`. Markdown render: sanitise, no raw HTML, no `javascript:`. Size cap ~256 KiB per plan. Dialogue is captions/TTS only — never `eval` or a worker argv.

### 4. Persistence

Plan survives reload (project JSON and/or a row keyed by project id). Banner after modal close: **Plan ready — confirm to generate.** Worker required locally: same banner pattern as generate/render.

## Consequences

- New tools: `draft_generation_plan`, `update_generation_plan` (and Apply/confirm as explicit operator action or `apply_generation_plan` that only runs after confirmSpend).
- Harness: make-an-ad detector may require plan draft first when video gen is on and £>0; then ADR-0055 on the generate phase.
- UX-first: status is the panel + banner, not a Send-button label.

## Rejected

- Cursor-style writable project filesystem.
- Overloading DirectorPlan with shot lists and dialogue.
- Freeform `plan.md` as the source of truth (injection + drift from Zod).
- Skipping confirmSpend because the plan was shown.
- Auto-applying the plan (same veto as ADR-0029).
