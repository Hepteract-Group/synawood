# Intent and Scenes

See [ADR-0026](../adr/0026-intent-and-scene-tree.md). Extends [`timeline-model.md`](./timeline-model.md).

**Operator runbook:** [Intent, Scenes, and AI Director](../../core/runbooks/intent-scenes-director.md).

## Purpose

Give every Studio Project two structured layers above `clips[]`:

- **Intent** — what the founder is trying to achieve. Editable, queryable, drives regeneration.
- **Scenes** — semantic grouping of clips by role (Hook / Problem / Solution / CTA / …). Enables per-scene regeneration and downstream analytics (Wave 2F Knowledge Graph).

## Data model

Both live on the **Studio Project JSON** (`project.intent`, `project.scenes`) per ADR-0003 / ADR-0026. No required Supabase columns in v1.

### Intent

```ts
type Intent = {
  goal?: 'awareness' | 'consideration' | 'signup' | 'purchase' | 'retention' | 'custom'
  goalNote?: string
  audience?: {
    persona?: string          // free text
    ageRange?: [number, number]
    context?: string          // "parents of newborns"
  }
  platform?: IntentPlatform // aligns short-form with AdPlatform: 'tiktok' | 'ig_reels' | 'yt_shorts' | 'meta_feed' | 'linkedin' | 'x' | 'youtube' | 'landing'
  emotion?: Emotion           // 'exciting' | 'emotional' | 'trustworthy' | 'humorous' | 'urgent' | 'calm' | 'aspirational' | 'informative'
  lengthSeconds?: number
  cta?: string
  brandVoice?: string         // free text, may match Brand kit voice.json id
  keywords?: string[]
}
```

Fields are individually optional. The object itself is always present (default `{}`). Zod schema in `core/creative/src/intent/`; wired on `studioProjectSchema`.

### Scene

```ts
type SceneRole =
  | 'hook' | 'problem' | 'context' | 'proof'
  | 'solution' | 'offer' | 'cta' | 'custom'

type Scene = {
  id: string                       // sc_xxx
  role: SceneRole
  label: string                    // "Hook — 'You've been doing this wrong'"
  intentNote?: string              // free text describing what this scene should do
  targetDurationFrames?: number    // soft goal; Director tries to fit
  clipIds: string[]                // ordered; a clip belongs to at most one scene
  overlayIds?: string[]            // hook title, lower thirds, etc.
  locked?: boolean                 // Director skips locked scenes on rebalance
}
```

Ordering of `scenes[]` is the story order. `clipIds` inside a scene is play order.

## Composition binding

Compositions do not read `scenes` in v1. Remotion still consumes `tracks[] + clips[] + overlays[]`. `scenes` are metadata + a UI/agent-facing layer. When the Director rebalances scenes, it emits mutations against the existing clip/track model — no renderer change.

Future: per-scene compositions (each scene mounts its own Remotion sub-composition). Left for a later ADR when the first case that needs it appears.

## Loading / defaults

- `parseStudioProject` / Zod defaults fill `intent: {}` and `scenes: []` when missing.
- Existing projects load unchanged aside from those defaults; `revision` untouched.
- No SQL migration in Wave 2A schema slice (#136).

## System prompt integration

`system-prompt.ts` gains a compact block:

```
INTENT
goal: signup   platform: tiktok   emotion: emotional   length: 15s
audience: parents (25-40) — first-time parents
CTA: Download today
brandVoice: warm-authoritative

SCENES
sc_001 hook (targetFrames 90) — attention-grabbing pain moment
sc_002 problem (targetFrames 150) — surface the frustration
sc_003 solution (targetFrames 180) — show the app
sc_004 cta (targetFrames 60) — download prompt
```

Empty fields are omitted. Total budget capped so scene lists never blow the prompt.

## New Studio Tools (see also [studio-tools.md](./studio-tools.md); Director in [ai-director.md](./ai-director.md) (ADR-0029))

| Tool | Purpose |
|---|---|
| `set_intent` | Merge patch into `project.intent`; validates enums |
| `plan_scenes` | Draft an initial scene list from intent + product marketing; returns a `ScenePlan` for founder Apply |
| `set_scene` | Update one scene (label / role / targetDurationFrames / intentNote) |
| `add_scene` / `remove_scene` / `reorder_scenes` | Structural edits |
| `assign_clip_to_scene` | Move a `clipId` into a scene (or out to `unassigned`) |

All are validated + mutate through `applyProjectMutation` (same path as existing tools; no-op guard).

## HTTP routes (dashboard; #142)

Thin wrappers around the same Studio Tools via `dashboard/lib/studio-tool-route.ts`:

| Method | Path | Tool |
|---|---|---|
| `GET` / `PATCH` | `/api/studio/projects/:id/intent` | read / `set_intent` |
| `GET` / `POST` | `/api/studio/projects/:id/scenes` | read / `add_scene` |
| `PATCH` / `DELETE` | `/api/studio/projects/:id/scenes/:sceneId` | `set_scene` / `remove_scene` |
| `POST` | `/api/studio/projects/:id/scenes/reorder` | `reorder_scenes` |
| `POST` | `/api/studio/projects/:id/scenes/plan` | `plan_scenes` (no write) |
| `POST` | `/api/studio/projects/:id/scenes/apply-plan` | `apply_scene_plan` |
| `POST` | `/api/studio/projects/:id/scenes/assign-clip` | `assign_clip_to_scene` |
| `GET` / `POST` | `/api/studio/projects/:id/director` | latest draft / `direct_project` |
| `POST` | `/api/studio/projects/:id/director/commit` | `commit_director_plan` |

Mutating calls require `expectedRevision` (except `scenes/plan`). Director `POST` defaults `dryRun: true`.

## Regeneration flow

Founder edits Intent → panel emits a debounced diff → chat receives a system event: *"intent changed: emotion exciting → emotional"* → agent may propose `direct_project({ intentOverrides, dryRun: true })`. The Director drafts mutations, founder previews (see [ai-director.md](./ai-director.md)), commits or rejects.

**Never auto-apply.** Intent changes must be a *diff review*.

## Concurrency

Scene edits use optimistic concurrency: `revision` bump on any project write. If two mutations race, second retries after fetching latest revision. The Director's `commit_director_plan` bumps revision once for the whole plan.

## Invariants

- Every `clipId` referenced in any `scene.clipIds` exists in `tracks[].clips[]`.
- A `clipId` is in **at most one** scene at a time.
- Sum of scene `targetDurationFrames` is advisory, not enforced — clip reality wins.
- Deleting a clip removes its `clipId` from any scene automatically (mutation post-gate).

## Failure modes

- Founder edits intent while a Director plan is in preview → the preview marks stale, offers "Refresh."
- `plan_scenes` returns a scene list that references non-existent clips → tool rejects with a plain-English error; agent tries again.
- Legacy projects with no scenes → UI shows "Infer scenes" button that calls `plan_scenes` with `preserveClipOrder: true`.
