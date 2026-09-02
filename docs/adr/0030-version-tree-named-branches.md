# ADR-0030 — Version tree: named branches within a Studio Project

**Status:** accepted  
**Date:** 2026-08-06  
**Wave:** Vision 2D · Plan index **11** · Epic [#179](https://github.com/Hepteract-Group/marketing-os/issues/179)  
**Related:** ADR-0003 (project JSON source of truth), ADR-0027 (variant **child projects** — complementary, not the same), ADR-0029 (Director Save-as-branch)  
**Does not supersede:** ADR-0027. Variant matrix fan-out stays as separate Studio Projects with `parent_project_id`. Named branches are **inside** one project.

## Context

Founders want stylistic forks (Funny / Luxury / Emotional) without undoing work or spinning up a full variant project. Vision dump: “Every edit becomes a branch… Switch instantly between styles.”

Epic children reference plan `11-version-tree.plan.md` and this ADR; neither existed in-repo until now. Without a contract, #180 cannot be implemented safely next to revision history and Ad Generator variants.

## Decision

### 1. Branches live on one Studio Project

- Table `studio_project_branches`: one row per named tip under a project.
- Every project has exactly one **`main`** branch (`is_main = true`, name/slug `main`).
- `studio_projects.active_branch_id` points at the branch the editor and tools currently mutate.
- Distinct from **variants** (`parent_project_id` / `variant_spec`): variants are sibling projects for platform×hook×CTA; branches are alternate timelines of the same project identity (chat, assets library, Approve target).

### 2. Each branch stores a full `project_json` tip + revision

v1 does **not** store sparse mutation overlays. Each branch row holds:

| Column | Meaning |
|---|---|
| `project_json` | Full Studio Project JSON for that tip (same shape as today) |
| `revision` | Optimistic concurrency for that branch tip |
| `parent_branch_id` | Branch this was forked from (null only for the synthetic root of `main`) |
| `forked_from_revision` | Parent tip revision at fork time (audit) |

Rationale: resolve/switch stays O(1); Director Save-as-branch clones the active tip; merge/compact (#181+) can introduce overlays later without changing the public “named tip” model.

### 3. `studio_projects.project_json` mirrors the **active** branch tip

Until all readers are branch-aware, the project row continues to hold the active tip:

- Backfill (#180): create `main`, copy current `project_json`/`revision`, set `active_branch_id = main`.
- Later slices (#182+): every successful mutation writes **both** `studio_project_branches` (active) and denormalized `studio_projects.project_json`/`revision`.
- Switching branch (#183/#186) swaps active tip into the project row inside one transaction.

### 4. Naming

- `main` is reserved and never deleted.
- Other names are founder-facing (e.g. `Funny`); slug is lowercase URL-safe unique per project.

## Consequences

- #180 = schema + main backfill only; no UI; no tool behaviour change yet.
- Branch revision history vs `studio_project_revisions`: **project-scoped in v1** (confirmed #189). Per-branch history would need a new ADR.
- Director Save-as-branch (#184/#187) creates a non-main branch from the resolved tip after commit.
- Variant Grid rekey (#188) stamps/displays `sourceBranchId` on variant children when the parent has named branches — not in #180.

## Rejected

- One-branch-per-edit auto-fork (too noisy; founder names styles).
- Reusing `parent_project_id` for branches (collides with ADR-0027 variants).
- Sparse overlays as the only storage in v1 (harder to debug; defer to compact).
