# Contextual clip suggestion panel

Backs [`contextual-clip-suggestions.md`](../architecture/contextual-clip-suggestions.md).

## Trigger

- **Single click on a clip** in the timeline → opens the panel next to the Player.
- **Right click** → same panel, plus native menu items (Split / Delete / Lock).
- **Close / Dismiss all / Escape** → closes and stays closed for that clip until **Suggestions** in the timeline inspector.
- Per-row **Dismiss** drops that suggestion without applying it.

## Placement

Right rail slides Chat down to accommodate a **Contextual drawer** in the upper half of the right rail (above chat). When Intent panel is expanded, Contextual drawer replaces it; a small toggle at the top switches between them.

Alternative on very narrow viewports (< 1280px): Contextual is a modal-less floating panel anchored to the clip.

## Anatomy

```
+---------------------------------------------------+
| Clip c_012 · 3.4s · video · Scene: Hook           |
| [thumbnail strip 6 frames]                        |
+---------------------------------------------------+
| Suggestions                                       |
|   [✓] Shorten to 2.1s          heuristic  · free   |
|   [✓] Add captions             heuristic  · free   |
|   [ ] Zoom on face (0.6s in)   heuristic  · free   |
|   [ ] Replace with alt take    heuristic  · free   |
|   [ ] Generate supporting B-roll (2s)              |
|         requires generator · est £0.18             |
|   [ ] Rewrite hook copy — "You've been…"           |
|         reasoner · free                            |
| ...                                               |
+---------------------------------------------------+
|  [ Apply selected ]   [ Refresh ]   [ More … ]     |
+---------------------------------------------------+
```

### Rows

Each row shows:

- Checkbox (default-checked for free heuristic suggestions; unchecked for `requiresGenerator`).
- Label (imperative — "Shorten to 2.1s", not "Shortening").
- Preview text (secondary, small).
- Kind pill (heuristic / reasoner / generator).
- Cost — "free" or "est £x.xx".

### Grouping

Sorted by expected impact within kind: heuristic → reasoner → generator. Within kind: highest score first.

### Bulk apply

- Multi-select via checkboxes → **Apply selected** shows sum of estimates.
- Cost sum > soft cap → button label switches to "Confirm (£X.XX)" and requires a second click.

### Per-row Apply

Hover row → inline **Apply** button appears on the right. Instant for free rows; confirm micro-modal for paid.

## Progress + failure states

After Apply:

- Free suggestions: row switches to check + "Applied" → row disappears on next open.
- Generator-backed: row switches to spinner + "Generating…" with a cancel affordance; when done, row updates to "Applied" or "Failed — see reason". Failed rows expand automatically.

Never hide a failure. The drawer keeps failed rows until dismissed.

## "More …" menu

- Refresh suggestions (bust cache) — costs a reasoner call, warns.
- Promote to Director plan — packages currently-checked suggestions into a `DirectorPlan` shell and opens the Preview modal (lets the founder rebalance neighboring clips).
- Copy JSON — dev-only when localhost.

## Scene-level panel

Right-clicking a scene card in the Scene strip opens the same drawer scoped to the scene:

- Suggestions include: "Add a beat clip", "Tighten pacing across scene", "Regenerate scene VO", "Swap 2 clips for library alternatives".
- Same rules apply: preview-first for paid, one-tap for free.

## Empty state

If no suggestions come back:

> **No suggestions right now.**
> _Try running the AI Director for a broader change, or refresh._

Never show fake filler.

## Accessibility

- The drawer is a focus trap when open; `Esc` closes.
- Checkboxes have labels; row is one keyboard tab-stop with inner controls reachable via arrow keys.
- Live region announces "Applied" / "Failed" per row so screen readers hear result.

## Interaction with Director

If the founder Applies a suggestion while a Director plan is `draft`, the plan is marked `stale`. Banner in the Director pill invites Refresh. Never silently rebase.
