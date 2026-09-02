# Chat grounding (composer)

Visual contract for [ADR-0072](../adr/0072-chat-grounding.md). UX: [chat-grounding.md](../ux/chat-grounding.md).

## Composer

Unsent **chips** sit above the textarea (or inline as tokens with chip chrome): time, clip, overlay, region. Each chip has a remove ×. Playhead control **@** next to timecode inserts a time chip.

Selected clip on the timeline shows a quiet “Grounded: {name}” under the composer until they send or clear. Do not hide this as a 10px icon.

## Player region (optional v1)

Draw-box on the player: dashed rectangle, confirm **Use in chat**. Inserts `@region`. Cancel clears. Do not leave an invisible hit area.

## Tokens in history

Sent messages show the same chips in the user bubble (read-only). Failed resolve: struck chip + the under-composer error on that turn only.
