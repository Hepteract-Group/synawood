# Intent panel and Scene strip

Backs [`intent-and-scenes.md`](../architecture/intent-and-scenes.md) and [`ai-director.md`](../architecture/ai-director.md). Sits inside the Studio editor chrome (ADR-0016).

## Where it lives

```
+------------------------------------------------------------------+
| Studio header — project title · brand chip · model dropdowns      |
+-----------+-----------------------------+--------------------------+
|           |                             |                          |
| Media bin |        Player + transport   |  Chat (right rail)       |
|  (left)   |                             |  ┌────────────────────┐  |
|           |                             |  │  Intent (collapsed) │  |
|           |                             |  ├────────────────────┤  |
|           |                             |  │  Chat messages       │  |
|           |                             |  │  Composer            │  |
|           |                             |  └────────────────────┘  |
+-----------+-----------------------------+--------------------------+
|  Scene strip  ┃ Timeline (full width)                              |
+------------------------------------------------------------------+
```

- **Intent panel** — one-line chip at the **top of the right rail**. Closed by default when populated. Expand opens an **overlay on the chat** (does not shrink the conversation). Chat header (name, New chat, Previous chats) is hidden and not tabbable until Done. Always present, even for legacy projects (starts empty).
- **Scene strip** — a horizontal lane **immediately above the timeline chrome**, running full width. Aligns with clip x-positions when scenes have targetDurationFrames set.

## Intent panel — states

### Empty (no intent set)

Full CTA card: "Set your intent — Goal, Audience, Platform, Emotion, Length, CTA. This lets the AI Director rebuild your cut on request." Button: **Set intent** (primary), **Skip** (ghost, closes panel to a slim chip).

### Populated (summary chip closed)

One-line chip above chat:

> **TikTok · 15s · emotional · Parents 25-40 · CTA "Download today"**

Click → expand to full form.

### Expanded

Grouped fields (labels first, values inline):

- Goal — segmented (Awareness / Consideration / Signup / Purchase / Retention / Custom)
- Audience — persona text + age range slider + context
- Platform — chips (single-select, drives length defaults)
- Emotion — chips (single-select, keyed to `director-vibes/*`)
- Length — number stepper (seconds)
- CTA — text
- Brand voice — text or "Use Brand kit voice"
- Keywords — chip input

Live-save (debounced 500ms) via `set_intent`. Every save bumps revision.

## Change-triggered Director prompt

When a **structural** intent field changes (`goal`, `platform`, `emotion`, `lengthSeconds`), the Director tab shows a rebuild badge. Opening Director overlays chat with:

> **Intent changed — emotion: exciting → emotional.**
> _AI Director can rebuild the cut. **Preview changes** · Dismiss_

Clicking **Preview changes** invokes `direct_project({ intentOverrides: {...}, dryRun: true })` and opens the Director Preview modal.

## Director Preview modal

Modal (not a drawer — this is a commitment moment):

- **Header** — "Director plan · style: emotional · scope: global"
- **Rationale** — 1–3 sentence agent explanation
- **Cost line** — bold total GBP · breakdown expandable
- **Diff list** — grouped by scene; checkboxes default-checked; per-row inline preview text ("Hook overlay: 'You've been…' → 'What if…'")
- **Failed generator rows** — auto-expanded with plain-English reason (ADR-0018)
- **Actions** — **Apply selected**, **Save as branch** (name + switch-after; forks tip, does not replace `main` — ADR-0030 / #187), **Refine** (opens a note field), **Reject**, **Close**
- **Persistence** — closing the modal keeps the plan; a **pill under the Player** ("Director plan pending · 4 changes · £0.32") re-opens it. Survives reload (per ADR-0029 director_plans table / plan persistence).

## Scene strip

### Populated

Horizontal lane above timeline. Each scene = a segment card:

```
[Hook 90f]  [Problem 150f]  [Solution 180f]  [CTA 60f]
```

- Card label = role + short label + target duration (frames or seconds toggle).
- Colored left-edge stripe by role (hook=orange, problem=slate, solution=green, cta=blue, custom=neutral).
- Locked scenes show a lock icon; Director skips them.
- Drag to reorder. Right-click / three-dot menu: Edit label / Set duration / Toggle lock / Assign clips / Delete.

### Empty

Skinny bar with two actions: **Add scene** (creates blank scene) · **Infer scenes** (calls `plan_scenes({ preserveClipOrder: true })`, previews in a small modal, Apply).

### Alignment to timeline

When every scene has `targetDurationFrames`, scene cards align proportionally with timeline frames (visual anchor lines drop from card boundaries to timeline). When durations are unset or clips exceed targets, cards float without alignment and show an amber "drift" indicator.

### Click a scene

- Left click → selects scene; timeline highlights that scene's clips; Chat composer shows a pill `@scene:hook`.
- Double click → opens Scene Editor drawer (right rail replaces Intent momentarily) with fields (label, role, intentNote, targetDurationFrames, clipIds list with drag-to-reorder).
- Right-click "Regenerate scene" → `direct_project({ scope: { sceneIds: [id] }, dryRun: true })` → preview modal.

## Keyboard

- `I` toggles Intent panel expand/collapse.
- `S` focuses scene strip; arrow keys move selection; Enter opens Scene Editor.
- `⌘K` command palette gains "Set intent", "Add scene", "Infer scenes", "Regenerate scene".

## Structure rail (ADR-0034)

Sits under Intent on the chat column. Optional snapshot of the ad’s story for learning. Empty does not block Approve.

### Empty (no scenes)

> This is the ad’s story: stop the scroll, teach, prove it, make the offer, then ask.
>
> Optional. Add scenes on the strip above the timeline first. You can still Approve without this.

Tab meta: **Not set**. Button **Fill from scenes** disabled. Tooltip: **Add scenes first**.

### Empty (scenes exist, story not filled)

> No story mapped yet. Fill from your scenes. This does not change the timeline.

Button **Fill from scenes** enabled.

### Filled

Tab meta is the kinds present, in order: **Hook · Teach · Proof · Offer · Ask**. List uses those labels, not Education / Trust / CTA / beats.

## Empty-project welcome

Brand-new project (no clips, no intent):

- Intent panel opens by default with the empty-state CTA.
- Scene strip shows **Infer scenes** disabled with tooltip "Add clips or run the Ad Generator first."
- Chat placeholder: "Tell me the goal — or paste a URL to use the Ad Generator."

## Errors and loud failure

Every intent write goes through `applyProjectMutation` — no-op reads reject. Toast on failure with plain reason. Never silent. Director partial failures render inside the modal, never in chat.

## Accessibility

- Every chip is a button with an accessible label.
- Focus ring visible on scene cards.
- Reduced motion honors `prefers-reduced-motion` — no scene-strip animate-in.
