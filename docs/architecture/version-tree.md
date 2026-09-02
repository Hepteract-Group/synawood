# Version tree (named branches)

How Studio Projects keep alternate timelines (Funny / Luxury / Emotional) without forking a new project. Decision: [ADR-0030](../adr/0030-version-tree-named-branches.md). Plan: [11-version-tree.plan.md](../../.cursor/plans/generated/11-version-tree.plan.md). Epic [#179](https://github.com/Hepteract-Group/marketing-os/issues/179).

## Vocabulary

| Term | Meaning |
|---|---|
| **Branch** | Named tip under one Studio Project (`studio_project_branches`) |
| **main** | Reserved default branch; always exists |
| **Active branch** | `studio_projects.active_branch_id` — what tools/UI mutate |
| **Variant** | Separate child **project** (ADR-0027) — not a branch |

## Storage

```text
studio_projects
  project_json / revision     -- denormalized ACTIVE tip (legacy-compatible)
  active_branch_id ──────────┐
                             │
studio_project_branches      │
  id ◄───────────────────────┘
  project_id
  name / slug                 -- main, Funny, …
  is_main
  parent_branch_id
  forked_from_revision
  project_json / revision     -- tip for this branch
```

## Read path (v1 after #180)

Unchanged callers read `studio_projects.project_json`. Backfill copies current JSON onto `main` and points `active_branch_id` there.

## Resolve + compact (#181)

| Helper | Role |
|---|---|
| `resolveBranchById` / `resolveBranchBySlug` / `resolveMainBranch` | Load a branch row |
| `resolveActiveBranch` | Active tip; falls back to `main` if unset/stale |
| `compactBranchTip` | Parse/normalize tip JSON onto the project identity |
| `syncActiveBranchMirror` | Write normalized active tip → branch row + denormalized `studio_projects.project_json`/`revision` |

Revision history (`studio_project_revisions`) stays **project-scoped** in v1 (**decided in #189** — no per-branch history table yet; undo/redo still walks the project tip).

## Write path (#182)

`saveProject` and undo/redo (`restoreRevision`) call `writeActiveBranchTip`:

1. `resolveActiveBranch`
2. Optimistic update on **active** `studio_project_branches` tip
3. Mirror onto `studio_projects.project_json` / `revision` / `history_tip`
4. Forward saves also `recordForwardRevision` (project-scoped history)

Call sites keep using `saveProject` — no per-route dual-write.

## Branch tools (#183)

| Tool / helper | Behavior |
|---|---|
| `list_branches` / `listBranchSummaries` | Name, slug, active flag, revision |
| `create_branch` / `createBranchFromActiveTip` | Fork active tip; `main` reserved |
| `switch_branch` / `switchActiveBranch` | Set `active_branch_id` + mirror tip (no tip mutation) |
| `promote_branch` / `promoteBranchToMain` | Full tip replace → `main` |
| `merge_branch` / `mergeBranchTip` | v1 **full tip replace** source → target (default `main`); no 3-way / sparse merge |
| `save_director_plan_as_branch` / `saveDirectorPlanAsBranch` | Commit Director plan → `createBranchFromActiveTip` (± switch). Modal is #187. |

## Switch path (from #183/#186)

Set `active_branch_id`, copy that tip into `studio_projects.project_json`/`revision`, return project.

## Switcher UI (#186)

Studio workspace bar (parent projects only): **Branch** compact menu — list tips, switch active, create (+ fork & switch). Hint copy distinguishes from Ad versions. Promote/merge stay API/agent for now.

## HTTP routes (#185)

| Method | Path | Auth | Backend |
|---|---|---|---|
| `GET` | `/api/studio/projects/:id/branches` | viewer | `listBranchSummaries` |
| `POST` | `/api/studio/projects/:id/branches` | editor | `create_branch` |
| `POST` | `/api/studio/projects/:id/branches/:branchId/switch` | editor | `switch_branch` |
| `POST` | `/api/studio/projects/:id/branches/:branchId/promote` | editor | `promote_branch` |
| `POST` | `/api/studio/projects/:id/branches/merge` | editor | `merge_branch` |
| `POST` | `/api/studio/projects/:id/director/save-as-branch` | editor | `save_director_plan_as_branch` |

Mutating bodies include `expectedRevision`. Write responses include `project` (+ optional `traceWarning`) for Studio reload. Switcher UI is #186.

## Relation to Director

After preview, **Save as branch** (Director modal #187) commits selected edits then clones the tip into a new named branch (does not replace `main` until promote/merge). Optional switch-after lands the editor on that tip; use the Branch switcher (#186) to move between tips.

## Variant Grid awareness (#188)

Ad versions (ADR-0027 child projects) stay separate from named branches. When `render_variants` creates children from a parent, each `variant_spec` is stamped with optional **`sourceBranchId`** (= parent `active_branch_id` at create time).

Variant Grid:

- Lede notes which branch tip new versions fork from (when the parent has >1 tip)
- Cells show **From {branch name}** when tagged
- Filter chips: All / each named branch / Untagged (legacy)

Does not retarget promote to a named branch — promote still writes the parent’s **active** tip.

Operator runbook: [studio-named-branches.md](../../core/runbooks/studio-named-branches.md) (#190).
