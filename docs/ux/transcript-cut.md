# Transcript cut

Operator-facing flow for [ADR-0071](../adr/0071-transcript-as-timeline.md). UI: [transcript-pane.md](../ui/transcript-pane.md).

## What they see

A **Transcript** pane (toggle next to the timeline or a tab in the media column — not a tiny pill). Words are selectable. Selecting a span opens a **cut menu** on the pane: Delete (ripple), Split, Trim to here. The **player** scrubs to that word. After Delete, the picture jumps to the new cut — that is the confirmation, not a toast alone.

Agent: “Cut the ums and dead air” → same cut list. Chat shows a short narration; **Why** row explains seconds removed ([ADR-0076](../adr/0076-why-log-and-targeted-regen.md)).

## Can they miss it?

Do not put “transcript ready” only on a bin badge. If a talking-head clip has no transcript, the pane **empty state** says “Transcribe this take” with the spend confirm. While transcribe runs: **modal** (minimize) + **banner** “Transcribing take…”. Reload restores the banner from the job.

Clarity that removes a large span: **confirm modal** (“Remove 18s of rambling?”) with Keep / Cut. Not a silent agent turn.

## Dismiss / reload

Cut-list jobs and transcribe jobs are server state. Closing the pane or chat does not cancel them. Banner remains until complete/fail. Failed job: one sentence + Retry on the banner.

## Backend

Transcription and clarity may need a worker. If it is not running (local), the banner says so — same as generation jobs.

## Non-goals

Chapters. Rewriting spoken words. A second script document that can disagree with the timeline.
