# ADR-0066 — Agent-named Studio chat threads

**Status:** accepted  
**Date:** 2026-08-23  
**Issue:** [#853](https://github.com/Hepteract-Group/marketing-os/issues/853)  
**Related:** [ADR-0056](./0056-studio-chat-threads.md)  
**Supersedes:** ADR-0056 §4 chrome only (title = first user line; “New chat” / “Previous chats” text). Threads still live on `studio_projects.chat_threads`. Does not change the cut.

## The product

After the first turn is fulfilled, the thread needs a short name the founder can scan — not the first words of a long prompt. They must be able to edit that name. Previous chats must not take a permanent row in the chat column.

## Decision

1. **Name after the first fulfilled turn.** When the active thread has a user message and an assistant reply, and `titleKind` is not `user` or `agent`, persist a ≤6-word title (`titleKind: 'agent'`). With `AI_GATEWAY_API_KEY`, this is a tiny reasoner call using the same model id as the turn. Without Gateway (or on mock / failure), clamp the user line to six words. One extra call, first turn only — a few hundred tokens, not video spend.
2. **Founder rename wins.** Editing the header title sets `titleKind: 'user'`. Later agent naming must not overwrite it. Saving messages must not retitle from the first user line.
3. **Chrome.** Header shows an editable title. **New chat** is a + icon. **Previous chats** is a clock icon; the list is a popover (search + Today / Yesterday / Previous 7 days / Older). It must not take a permanent row in the chat column.

## Rejected

- Retrying the same failed Seedance job as a title source.
- A second agent process for naming.
- Unbounded founder titles in the list (still clamp to six words / 48 chars).
