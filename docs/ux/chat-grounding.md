# Chat grounding

Operator-facing flow for [ADR-0072](../adr/0072-chat-grounding.md). UI: [chat-grounding.md](../ui/chat-grounding.md).

## What they see

In the **composer**, chips: playhead time, selected clip name, selected overlay, optional region. Clicking **@ time** on the player chrome inserts `@t:00:12`. Selecting a clip and sending “swap B-roll here” includes that clip even without a typed token.

Chips are readable (`@ 0:12`, `@ Hook title`), not raw ids.

## Can they miss it?

If resolution fails, the composer shows **one line under Send**: “That clip is gone — pick another.” Do not send a turn that silently drops grounding. Do not rely on Thoughts to explain a missed `@`.

## Dismiss / reload

Tokens live in the unsent composer (ephemeral). **After send**, grounding is on the server turn. Reloading mid-compose may lose unsent chips — acceptable. Reloading after send must not lose the why-log or the edit.

## Backend

Resolve tokens on the chat route. No extra worker.

## Non-goals

Slash-command palette. Screenshot-to-chat (Later). A second command language besides Studio Tools.
