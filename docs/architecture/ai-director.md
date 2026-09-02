# AI Director

See [ADR-0029](../adr/0029-ai-director-and-contextual-suggestions.md). Depends on [`intent-and-scenes.md`](./intent-and-scenes.md).

**Operator runbook:** [Intent, Scenes, and AI Director](../../core/runbooks/intent-scenes-director.md).

## What it is

A **fat tool** that turns an intent shift or a vibe request ("make this feel premium") into a **DirectorPlan** — a set of proposed project mutations plus a rationale and a cost estimate. The founder previews the plan and Applies or Rejects. It does not touch the project until commit.

Under the hood, `direct_project` calls the reasoner (via AI SDK) with a specialized system prompt built from a curated skill pack (ADR-0031). The outer Studio Agent sees exactly one tool call. No LangGraph. No new runtime.

## Tool contract

```ts
type DirectProjectInput = {
  style?: string                              // 'premium' | 'energetic' | 'urgent' | 'cinematic' | 'informative' | free text
  intentOverrides?: Partial<Intent>           // simulate an intent change without persisting yet
  scope?: 'global' | { sceneIds: string[] } | { clipIds: string[] }
  dryRun?: boolean                            // default true
  maxCostGbp?: number                         // hard cap for this plan; below soft cap = auto-approve pathway
  refinement?: {
    priorPlanId: string
    note: string                              // "more subtle", "keep music"
  }
}

type DirectorPlan = {
  id: string
  createdAt: string
  scope: DirectProjectInput['scope']
  edits: ProjectMutation[]        // typed mutations; SAME shape as any other Studio Tool call
  rationale: string               // 1-3 sentences, founder-facing
  changeSummary: {                // grouped for the diff UI
    bySceneId: Record<string, ChangeGroup>
    generatorCalls: GeneratorPlan[]  // pending generate_image / generate_video_clip
  }
  costEstimateGbp: number
  status: 'draft' | 'applied' | 'rejected' | 'stale'
  reasonerModelId: string
}
```

Persisted in `director_plans` table (#139; see ADR-0029). Optional `project.directorPlan` mirror for schema round-trips until the table lands. Founder can close and reopen the modal; the plan survives.

HTTP (Wave 2A #142): `GET|POST /api/studio/projects/:id/director` and `POST .../director/commit` — see [intent-and-scenes.md](./intent-and-scenes.md#http-routes-dashboard-142).

## Commit

```ts
type CommitDirectorPlan = { planId: string; excludeMutationIds?: string[] }
```

Applies the plan atomically. `excludeMutationIds` lets the founder cherry-pick from the diff (Reject a single change but Apply the rest). Bumps project revision once.

## Save as branch (#184)

```ts
type SaveDirectorPlanAsBranch = {
  planId: string
  branchName: string // 1–40 chars; not "main"
  excludeMutationIds?: string[]
  switchAfter?: boolean
}
```

Studio Tool `save_director_plan_as_branch`: **commit** the draft onto the active tip, then **fork** that post-commit tip via `createBranchFromActiveTip` (ADR-0030). Does not replace `main`.

HTTP (#185): `POST /api/studio/projects/:id/director/save-as-branch`. Modal UX (#187): **Save as branch** on the Director preview modal (branch name + optional switch-after; parent projects only).

## Preview UX

See [`docs/ux/intent-panel.md`](../ux/intent-panel.md) *(Director section)*. Key rules:

- **Always preview** — even if cost is 0 (heuristic-only plans).
- **Grouped diff** — mutations grouped by `sceneId`, then by kind (copy edit, clip swap, overlay change, generator call).
- **Cost line** — bold, GBP, breakdown expandable.
- **Cherry-pick** — each row has a checkbox default-checked.
- **Refine** — a note field posts a follow-up `direct_project` call with `refinement`.
- **Failure state** — partial success (some generator calls failed): Apply-what-worked button appears; failed rows expand automatically (ADR-0018).

## Skill pack: `director-vibes/`

`core/marketing-skills/director-vibes/` contains one markdown per named style. Each doc describes preferred pacing, cut density, colour tendencies, music tempo range, caption density, hook style, end-card treatment. When `style` is set, the matching pack loads into the Director's system prompt. When `style` is free text, a small "vibes matcher" step maps it to the closest curated pack (with a warning that free text is best-effort).

## Guardrails

- **Never mutate on `dryRun: true`.** Enforced at tool boundary; unit-tested.
- **Cost cap.** If the estimator exceeds `maxCostGbp` (default = remaining monthly budget × 0.25), the tool returns a plan with `status: draft` **and** `costEstimateGbp` but `edits: []` — founder must widen scope explicitly.
- **Locked scenes** (`scene.locked === true`) are never included in `edits` unless scope names them.
- **Idempotence.** Re-running `direct_project` with the same inputs against the same revision returns a cached plan (per project revision + input hash).
- **No renderer calls.** `render_export` is separate; Director never renders.

## Relationship to other tools

Director is a **planner** on top of the primitives. All primitives it emits remain available directly to chat and to `suggest_for_clip`. There is one mutation vocabulary.

## Failure modes

- Reasoner emits an invalid `ProjectMutation` → tool boundary rejects it; the entire plan is returned with `rejected` mutations flagged; founder sees which failed.
- Generator estimate cannot be computed (model registry missing) → plan is `draft`, marked cost `unknown`, commit disallowed until profile set.
- Plan becomes `stale` when project revision advances (someone else committed edits) → modal offers "Refresh plan" which re-invokes `direct_project`.
