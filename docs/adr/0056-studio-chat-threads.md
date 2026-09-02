# ADR-0056 — Studio chat threads (new chat / previous chats)

**Status:** accepted  
**Date:** 2026-08-20  
**Issue:** [#576](https://github.com/Hepteract-Group/marketing-os/issues/576)  
**Related:** ADR-0019 (narration + Thoughts), ADR-0003 (project JSON is the cut)  
**Does not supersede:** ADR-0019. Threads are another persist shape for the same chat, not a second agent.

## The product

The founder is mid-cut on a Studio project. Chat filled up with an earlier experiment. They want a **new conversation** without losing the timeline, and they want to reopen yesterday’s chat on the same project.

Today there is one `chat_messages` array per project. New chat would have to wipe that array. That is wrong.

## Decision

### 1. Threads live on the project row, not in project JSON

`studio_projects.chat_threads` is jsonb: `{ activeId, threads: [{ id, title, createdAt, messages }] }`.

The **cut** stays `project_json`. Switching threads never mutates clips, assets, or revision.

### 2. Hydrate the legacy array

If `chat_threads.threads` is empty, wrap existing `chat_messages` as the first thread (title from the first user line). Keep writing `chat_messages` as a **capped (80)** copy of the active thread so usage/debug readers do not break. Full history lives on `chat_threads` — do not cap per-thread messages there.

### 3. New chat is an empty thread

New chat inserts an empty thread, makes it active, and leaves every other thread intact. The player and timeline do not change.

### 4. Chrome

Studio chat header: **editable thread title**, **+** (New chat), and a **clock** that opens a previous-chats popover (search + date groups). Titles are agent-named after the first fulfilled turn; the founder can rename. See [ADR-0066](./0066-agent-named-studio-chat-threads.md).

Thoughts stay per assistant message (ADR-0019). They do not become a global activity log across threads.

## Rejected

- Wiping `chat_messages` to fake a new chat.
- Sharing threads across projects.
- Storing threads inside `project_json` (would bump revision on every send).
- A second Studio Agent process per thread.
