# ADR-0019 — Studio chat: narration + collapsible receipts

**Status:** accepted  
**Date:** 2026-08-02  
**Supersedes (presentation only):** ADR-0018 §1 “Trace-grounded responses” as the *chat presentation* rule  
**Amended by [#547](https://github.com/Hepteract-Group/marketing-os/issues/547):** the in-chat receipts chrome is labelled **Thoughts** (collapsed; auto-opens on tool failure). Assistant narration renders lightweight markdown (`ChatMarkdown` / `simple-markdown`, no extra deps). The persisted field remains `ChatMessage.activity`.  
**Amended by [ADR-0056](./0056-studio-chat-threads.md):** multiple chats per project. Switching threads does not change the cut.  
**Amended by [ADR-0076](./0076-why-log-and-targeted-regen.md):** operator-facing **why-log** (persisted on the project) is separate from Thoughts/receipts. Targeted regen of one effect is in scope.  
**Amended by [ADR-0088](./0088-music-request-must-generate.md) / [#1016](https://github.com/Hepteract-Group/marketing-os/issues/1016):** third-person music-bed claims are blocked unless `generate_music` succeeded. Music requests also force first-step `generate_music`.

## Context

ADR-0018 correctly made the tool trace the ground truth for *what happened*. The implementation also **replaced** assistant chat text with joined tool summaries whenever tools ran. That stopped fabricated success claims, but the chat no longer felt like a conversation — founders saw raw receipts (`Planned 3 slides`, `Set background on slide_1`) instead of a short human update.

Modern product chats (Cursor, ChatGPT) keep **activity secondary** (collapsible) and keep **narration primary**.

## Decision

Split two channels for each Studio Agent turn:

1. **Narration** — user-visible assistant bubble. Prefer the reasoner’s `result.text` when non-empty after tools run. If empty, synthesize one short line from successful tool summaries and invite a next step. Still **block narrate-without-act** when *no* tools ran and the model claims edits (`CLAIMS_EDIT`).
2. **Receipts** — `toolTrace` for the turn, rendered in chat as a collapsible **Thoughts** block (default collapsed; auto-expand when any tool failed). Persisted on the assistant `ChatMessage.activity` array so reload keeps the pairing. Narration in the bubble is markdown (bold, lists, headings), never raw asterisks and never a tool dump.

ADR-0018 gates and QC remain mandatory. Narration must not be treated as source of truth for project state — the project JSON and tool outcomes are.

## Consequences

- Chat feels conversational without re-opening fabrication holes for “please wait” / zero-tool turns.
- Usage page ToolTrace stays the full audit trail; Thoughts is the in-chat subset for the current turn.
- Downstream consumers of `assistantText` get narration, not a dump of tool lines.
