# ADR-0070 — Studio operators are a marketing team

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Related:** [ADR-0024](./0024-product-auth-and-membership.md), [ADR-0037](./0037-functional-roles.md), [ADR-0042](./0042-governance-approval-chains.md), [ADR-0049](./0049-direct-branded-ad.md)  
**Does not supersede:** ADR-0024 (Product is still the tenancy unit). Timeline concurrency in [editable-timeline.md](../architecture/editable-timeline.md) (one `expectedRevision`; agent turn vs queued human edits).

ADR-0066–0069 are reserved by an in-flight PR (chat titles / SaaS identity). This wave starts at **0070** so numbers do not collide.

## Context

Competitive notes and older Studio copy said Creative Studio was for **one founder** shipping branded ads. That is wrong. The product is for a **marketing team** shipping branded ads: owners, editors, reviewers, publishers on one Product (ADR-0024 / 0037).

OpusClip and Descript sell **live multi-editor** (Google-Docs-on-a-timeline). Founder veto: we do **not** copy that. Team ≠ CapCut collab.

## Decision

### 1. Who the product is for

Creative Studio is operated by a **marketing team**. Any Product member with tenancy `owner` or `editor` (and functional role `founder` or `editor`) may cut, chat, and submit for Approve. Reviewers and publishers follow ADR-0042 / ADR-0065. Viewers watch; they do not mutate the Studio Project.

Say **operator** or **marketing team** in Studio docs unless you mean the ADR-0037 functional role `founder`.

### 2. Team is membership, not a shared cursor

- Many people on one Product: yes (already shipped).
- Handoff: open the same Studio Project, continue the chat, Approve on the Work board.
- **Live co-editing** (two cursors, presence, simultaneous timeline writes): **never** in this wave. Optimistic concurrency + “agent is editing…” remains the conflict model ([editable-timeline.md](../architecture/editable-timeline.md)). Last writer with a matching `expectedRevision` wins; the other retries.

### 3. Success still matches ADR-0049

Weekly **Final ads** (30–120s) with video, music, and brand. Zero freelance editor hours. Success is not “looks like a team CapCut.”

## Consequences

- CONTEXT, system design, UX, and competitive thesis use marketing-team language.
- Do not file issues for Rooms, presence avatars, or Google-Docs timeline.
- Governance chains (ADR-0042) stay the way a team signs off — not a second editor product.

## Rejected

- Live multiplayer / CRDT timeline.
- One-seat product packaging as the thesis.
- Treating “team workspace” as a reason to copy OpusClip collab SKUs.
