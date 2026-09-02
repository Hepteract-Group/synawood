# ADR-0062 — Generated assets are reviewed on AI Media, then placed in Studio

**Status:** accepted  
**Date:** 2026-08-22  
**Plan:** 28 · Epic [#780](https://github.com/Hepteract-Group/marketing-os/issues/780) · Review task [#783](https://github.com/Hepteract-Group/marketing-os/issues/783)  
**Related:** ADR-0061 (the surface), ADR-0005 / 0006 (generate + brand), ADR-0018 (QC + loud failure), ADR-0010 (Approve ≠ this review)  
**Does not supersede:** Approve of a Final (ADR-0010). Cut review of a Studio Project (ADR-0051).

## Context

Dashboard shell promised **generated asset review**. A row that says “Video clip · Ready” is not review. The founder cannot tell whether the clip is usable, or get it onto a timeline, without opening Studio and hunting the Media bin.

Jobs already store `output_asset_id`, status, estimated/actual GBP, and `project_id`. The page does not show the asset.

## Decision

### 1. Ready means you can see or hear the output

A **ready** job with an output asset shows that asset on AI Media: still thumbnail, short video player, or audio control. Role, status, time, and £ sit next to it — they do not replace it.

Jobs with no playable file (extract, index, transcribe) stay as honest status rows. Do not invent a poster.

### 2. Place is Studio, not a second timeline

**Place in Studio** opens the job’s Studio Project (or Studio home if none). Attach the ready output with **`add_generated_asset`**, then put it on a track with **`add_clip`**. AI Media does not grow tracks, a player of the *cut*, or Approve.

### 3. Failed is loud; Retry is the same generate path

Failed jobs show `errorMessage` as an alert, not a muted line. **Retry** re-runs **that same job** (same role, snapshot, project) through existing Generation Job machinery. It is not a new prompt and not a generate composer. Modal on start (minimize) + persistent banner; `confirmSpend` when estimated £>0 (ADR-0018). No silent mock swap.

### 4. This review is not Approve

Approve promotes a **Final** from a Studio Project. AI Media review only answers: did this generate succeed, what did it make, do I want it on a cut. A gorgeous generated clip still needs music + brand on the ad (ADR-0049) before Approve.

## Rejected

- Status-only rows as “review.”
- Assembling or Approving Finals on `/ai-media`.
- A new place-on-timeline protocol that bypasses Studio Tools.
