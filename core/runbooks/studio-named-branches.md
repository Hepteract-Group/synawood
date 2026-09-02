# Runbook: Studio named branches

**Purpose:** Keep stylistic forks (Funny / Luxury / Emotional) as **named tips inside one Studio project**, switch between them without undoing, and optionally save a Director preview onto a new tip — without creating Ad Generator child projects.
**Cadence:** As needed when exploring alternate cuts on a parent project.
**Owner:** Founder (marketing operator).
**Time budget:** 2–10 minutes to create/switch; 5–15 minutes when coupled with a Director Save-as-branch.
**Automation status:** partially automated — Branch switcher + Director **Save as branch**; promote/merge remain API/agent for now (ADR-0030).

## Vocabulary (do not mix)

| Term | What it is | Where |
|---|---|---|
| **Branch** | Named tip inside **one** project (`main`, Funny, …) | Workspace bar **Branch** chip |
| **Ad version / variant** | Separate **child** project (platform × hook × CTA) | **Ad versions** grid |

Contracts: [ADR-0030](../../docs/adr/0030-version-tree-named-branches.md), [version-tree](../../docs/architecture/version-tree.md). Variants: [ADR-0027](../../docs/adr/0027-ad-generator-and-variants.md).

## Inputs

- Local review dashboard: `npm run dev:review` → `http://127.0.0.1:3011/studio/<id>` (Synawood Supabase — never the private example).
- A **parent** Studio project (not an Ad version child). Branch UI is hidden on children.
- Optional: an open Director draft if you want Save-as-branch.

## Steps

### A — See and switch branches

1. Open a parent project. Done = workspace bar shows a **Branch** chip (usually `main`).
2. Open the menu. Done = list of tips + hint that these are **not** Ad versions.
3. Click another tip (or **New branch** → name e.g. `Funny` → Create). Done = timeline/player reflect that tip; chip label updates. Reload still shows the same active tip.

### B — Edit on a tip

1. With the desired branch active, edit timeline / Intent / overlays as usual. Done = saves target the **active** tip (and its mirror on the project row).
2. Undo/redo still works at the project level (history is project-scoped in v1 — not a separate stack per branch).

### C — Director Save as branch

1. From Intent, **Preview** a Director plan. Done = Director preview modal open with checkboxes.
2. Cherry-pick edits → **Save as branch** → name the tip → leave **Switch to this branch after save** on (usual). Done = modal closes; chip shows the new name; timeline has the applied edits on that tip. `main` is unchanged until you promote/merge later.
3. Prefer this over **Apply** when the experiment should not land on the tip you’re currently editing.

### D — Ad versions from a tip

1. Switch to the tip you want to package (e.g. Funny).
2. Open **Ad versions** and create a small set. Done = new cells show **From Funny** (or the active tip name); filter chips can isolate that tip.
3. Promote from a child still writes the parent’s **active** tip — switch first if you meant main.

## Outputs

- One or more named tips under the same project id.
- Optional Director-applied tip that is not `main`.
- Optional Ad versions stamped with `sourceBranchId` for filtering.

## Escalation

| Symptom | What to do |
|---|---|
| No Branch chip | You are on an Ad version child — use **← Main cut**, or open the parent from Studio home. |
| “Updated elsewhere” / 409 | Reload the project, then retry the switch/save. |
| Lost edits after switch | They are on the previous tip — switch back; tips do not auto-merge. |
| Confused with Ad versions | Branches = styles inside one cut. Ad versions = separate projects for platforms/hooks/CTAs. |
| Need Funny → overwrite main | Use promote/merge via agent/API for now (no polished menu in the switcher yet). |

Stop and ask before mass-promoting experimental tips onto `main` right before a paid export.

## Related

- Director flow: [intent-scenes-director.md](./intent-scenes-director.md)
- Ad versions: [ad-generator-from-url.md](./ad-generator-from-url.md)

## Change log

- 2026-08-07 — Initial Wave 2D runbook (plan 11 / #190).
