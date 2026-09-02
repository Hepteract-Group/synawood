# Approval thumbnail

Operator-facing flow for [ADR-0077](../adr/0077-approval-thumbnails.md). Lives on **needs_review** and the **Work board**, not in the Studio Agent loop.

## What they see

On the player review chrome (and the Work board card after Export): **Thumbnail** — a row of 1–4 stills plus **Generate**. Picking one outlines that still. Approve does **not** require a pick.

YouTube (and any channel that needs a still): Work board **Schedule** nudges “Pick a thumbnail” if none is set. Nudge is a **banner on the card**, not a greyed Schedule with no copy.

## Can they miss it?

Do not hide this on a media-bin tab the agent never opens. Do not put it only in chat. The review chrome is the surface.

## Dismiss / reload

Generate is a job: **modal** (minimize) + **banner** “Making thumbnail options…”. Reload on `/studio/…` or the Work board polls and restores the stills. Chosen id is server state on the project / Final.

## Backend

Worker required for generate. If missing, banner says so. Picking an existing player frame does not need a worker.

## Agent

The agent may remind them to pick a thumbnail **after** the ad is watchable. It must not block `inspect_preview` on this job.
