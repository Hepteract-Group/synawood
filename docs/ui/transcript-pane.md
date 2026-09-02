# Transcript pane

Visual contract for [ADR-0071](../adr/0071-transcript-as-timeline.md). UX: [transcript-cut.md](../ux/transcript-cut.md).

## Placement

Transcript sits **under the player** as an alternate to (or split with) the timeline: a resizable pane, same width as player + media. Chat stays full height on the right. Do not put the script in a popover.

Collapsed: a **Transcript** restore control on the timeline rail (same pattern as Scenes). Collapse persists in `localStorage`.

## Content

- Words wrap as a readable script. Current word (playhead) has a clear highlight (not 4px underline).
- Selection = light fill + the **cut menu** anchored to the selection (Delete / Split / Trim). Keyboard: Delete = ripple-delete when the pane is focused.
- Speakers optional later; v1 is one talking-head voice.
- Empty: “Transcribe this take” primary button. Job banner above the pane, not on the button label after click.

## Motion

Playhead follow is linear, not bouncy. Cut apply: script text collapses; player seeks. Respect reduced motion (instant seek, no word pulse).

## Team

Two members do not edit the script at once ([ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)). Soft-lock when `chatPending` matches the timeline lock.
