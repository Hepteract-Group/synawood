# ADR-0076 — Why-log and targeted effect regen

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Amends:** [ADR-0019](./0019-studio-chat-narration-and-receipts.md) (Thoughts/receipts are tool names, not operator-facing “why”)  
**Related:** [ADR-0018](./0018-studio-agent-trust-model.md), [ADR-0051](./0051-agent-watches-the-player.md), [ADR-0073](./0073-talking-head-first-pass.md)

## Context

OpusClip AI Producer shows an edit log (“why this B-roll at 0:12”) and can regen **one** effect. Studio Thoughts are collapsible tool receipts. Usage has the full trace. Operators still cannot see *why* a cut or duck happened, and “change that flash, not the whole ad” has no tool.

## Decision

### 1. Why-log is a first-class, persisted list

Each Studio Agent turn that mutates the project appends **Why entries** to the project (or the chat thread), not only `ChatMessage.activity`:

```
{ id, t, target: clipId | overlayId | 'cut', action, reason }
```

Examples: “Removed 1.2s pause at 0:08 — dead air.” “Ducked music −8dB under speech.” “Zoom on splice at 0:14 so the filler cut does not jump.”

**Narration** (ADR-0019) stays the bubble. **Thoughts** stay the tool trace. **Why-log** is the operator-facing list they can open from chat or a **Edits** rail. Reload must show it (server state). It is not a console log.

Why-log is **not** source of truth for the cut (project JSON is). It must not claim success the tools did not perform (ADR-0018).

### 2. Targeted regen

Tool `regen_effect` (name flexible): input `target` = clip treatment, overlay, caption style, SFX placement, or B-roll window — **not** the whole timeline. Re-runs that step (optional new seed / prompt). Then `inspect_preview` on the touched window.

Director dry-run stays for whole-cut plans. Targeted regen is for “that flash is too much.”

### 3. UX-first

- Why-log: a **panel** (Edits) the operator can open; new entries also summarized in narration. Not only a pill.
- Regen: select the effect on the timeline or a why-log row → **Regenerate this**. Job-shaped work uses **modal + banner**. Fast mutations update the player in place.
- Dismissing the chat thread does not drop the why-log (it lives on the project).

## Consequences

- Schema: `whyLog[]` on the Studio Project (capped, e.g. last 100) and/or per thread. Prefer project so any team member sees it ([ADR-0070](./0070-studio-operators-are-a-marketing-team.md)).
- Usage ToolTrace remains the audit trail for engineering.

## Rejected

- Replacing Thoughts with the why-log (keep both; different audiences).
- Silent whole-project regen when the operator asked to change one effect.
- Making why-log a customer-facing “AI Producer” brand.
