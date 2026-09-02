# ADR-0077 — Channel thumbnails at Approve, not in the Studio Agent

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Related:** [ADR-0010](./0010-publish-after-approve.md), [ADR-0065](./0065-schedule-after-approve.md), [ADR-0049](./0049-direct-branded-ad.md)  
**Founder override:** competitive row “Thumbnail generator” was Later; **Veto → Now, during content approval**.

## Context

OpusClip and Descript generate YouTube-style thumbnails inside the editor. That pulls the Studio Agent into a content mill. Founder: thumbnails are part of **content approval**, not the editor-agent loop. Slideshow cover stills already exist; weekly ads still ship without a channel thumbnail the team can pick.

## Decision

### 1. Where it lives

After Export, on **needs_review** / Approve (player chrome + Work board card): **Choose thumbnail** — generate or pick a still from the cut. Not a Studio Tool the agent must call to finish an ad. Not a chat skill.

Schedule / Post now (ADR-0065) may attach the chosen still as the Postiz/YouTube thumbnail when the channel needs one. Approve still does not post.

### 2. What it produces

- 1–4 candidate stills (player frame + optional branded frame: hook text + Path C logo).
- Operator picks one. Stored on the Final asset (`thumbnailAssetId`).
- Generate is a **Generation Job**: **modal + persistent banner** on the review surface. Reload polls. Missing worker → banner says so. Status is not a disabled Approve button label.

Approve without a thumbnail is **allowed** (ads on TikTok often need none). Channels that require a thumbnail (YouTube) **nudge** on the Work board before Schedule, they do not block Approve.

### 3. What the agent does not do

The Studio Agent does not auto-generate thumbnails in the first pass ([ADR-0073](./0073-talking-head-first-pass.md)). It may mention “pick a thumbnail on Approve” in narration. It must not stall `inspect_preview` on thumbnail jobs.

## Consequences

- Review-gates UX grows a thumbnail step. Studio layout does not add a Thumbnail tab to the media bin as the primary path.
- Slideshow cover stills can reuse the same picker.

## Rejected

- Thumbnail generator as an OpusClip-style editor SKU.
- In-agent “make me a viral thumbnail then post.”
- Blocking every Approve on a thumbnail.
