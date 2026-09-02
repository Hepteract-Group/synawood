# ADR-0047 — Intelligent B-roll assembly (library-first, generate-to-fill)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision **2I** · Plan index **25** · Epic [#512](https://github.com/Hepteract-Group/marketing-os/issues/512)  
**Product goal:** [ADR-0049](./0049-direct-branded-ad.md) — a 30–120s ad with video, music, and brand. This ADR is one way to get the picture track right.  
**Operator runbook:** [broll-assembly.md](../../core/runbooks/broll-assembly.md).  
**Related:** ADR-0001 (harness), ADR-0003 (project JSON), ADR-0018 (spend), ADR-0026 (Intent + Scenes), ADR-0032 (asset intelligence), [ADR-0052](./0052-visual-shot-embeddings.md) (visual Moments), ADR-0041 (music), ADR-0046 (PIP lane), ADR-0048 (generate video), ADR-0049 (the ad)  
**Does not supersede:** ADR-0032, ADR-0034, ADR-0046.  
**Amended by [ADR-0051](./0051-agent-watches-the-player.md):** Assembly is not a customer-facing “B-roll” recipe. Generated picture goes on the main track unless they asked for overlay. Cut review of the player is required before the turn can complete.  
**Amended by [#526](https://github.com/Hepteract-Group/marketing-os/issues/526):** the system prompt and mock-reasoner eval require `find_moments` (with `sceneRole`) before `generate_video_clip` when covering a Scene from library footage. A Generator MP4 is never Final.  
**Corrects:** Epic [#20](https://github.com/Hepteract-Group/marketing-os/issues/20) mixed video with MCP/Postiz. Video work is #512. Postiz is [#787](https://github.com/Hepteract-Group/marketing-os/issues/787).

## Context

The founder can already index footage, name Scenes, and drop a PIP lane. They still cannot say “use the Export close-up on the proof beat, generate the rest, add music” and get an ad. That picture+music work sits under ADR-0049.

“Asset knowledge graph” here means: indexed **Shots** + **Scenes** + timeline **clips**. Not a graph database.

## Decision

### 1. Use the library first, then generate

For picture the ad still needs:

1. Search **Moments** (`find_moments`) in this Product’s footage.
2. Place them on B-roll (`place_shot`) using the shot’s in/out, not the whole file.
3. **Generate** video (text-to-video, or image-to-video from a still) and/or stills for holes. Keep going until the ad is the requested 30–120s (ADR-0049).
4. Add **music** if the ad does not already have a bed (`generate_music`).
5. Attach clips to Scenes so the cut is sectioned (hook / proof / CTA).

Do not skip usable library shots just because a video model is available. Do not stop at a 4s clip and call it the ad.

### 2. Show the plan before spend

`assemble_broll` drafts a plan (`dryRun` default on): which Moments, which generates, music, cost. `commit_broll_plan` runs it. Confirm when £>0. Banner while jobs run. Plan survives reload.

### 3. Place the moment, not the whole take

A 2s shot from a 40s file must land as ~2s on the timeline.

### 4. Update means replace

“Change the proof B-roll” replaces that window. Do not stack a second clip on top and leave the old one.

### 5. Same Studio Agent

Same chat, same project, same tools. No second app.

## Rejected

- Stopping after a few B-roll clips and never adding music or brand (violates ADR-0049).
- Auto-applying a plan with no confirm (ADR-0018).
- A graph database (ADR-0034).
- Only placing whole files (wastes the shot index).
- MCP in this wave (#20). Postiz is Plan 29 / #787.
- Turning paid video on for `founder-edit` by default.
