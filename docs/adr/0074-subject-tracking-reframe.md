# ADR-0074 — Subject-tracking reframe (not a clipping mill)

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Related:** [ADR-0027](./0027-ad-generator-and-variants.md) (aspect variants), [ADR-0003](./0003-project-json-source-of-truth.md), [ADR-0049](./0049-direct-branded-ad.md)  
**Does not supersede:** Ad Generator variants. Reframe is a **clip treatment**, not a virality product.

## Context

Marketing teams shoot 16:9 talking-head and need 9:16 ads (and the reverse). OpusClip ReframeAnything tracks a subject. Studio variants change composition aspect; they do not crop a person into a vertical frame over time. Manual keyframed crop can wait. Auto subject-tracking cannot, or every vertical ad is letterboxed or a static center crop that chops the face.

## Decision

### 1. Tool: `reframe_clip`

Input: clip id, target aspect (`9:16` \| `16:9` \| `1:1` \| `4:5`), optional subject hint (`face` default).  
Output: clip gains `reframe: { aspect, tracking: [{ t, x, y, w, h }] }` in 0–1 of source, **or** a new cropped asset if the vendor returns a file.

Preview and Remotion export honor `reframe` (pan/scan). Do not silently bake a second MP4 unless the operator exports.

### 2. Job + UX-first

Tracking is a **Generation Job** (or equivalent async job). **Modal on start** (minimize) + **persistent banner** (“Reframing take to 9:16…”) that survives chat close and reload. Poll server state. Do not put status only on a timeline pill. If the worker is not running, the banner says so.

When the job completes, the **player** shows the new framing. Approve/Export stay gated on server job state, not a client flag.

### 3. Not a mill

- One Studio Project, one ad (or Ad Generator children). Do not auto-slice a webinar into ten scored shorts.
- Center-active-speaker for two-person interviews is **Later**.
- 30/70 gameplay layout stays vetoed.

## Consequences

- Variant matrix (ADR-0027) may call `reframe_clip` when the parent take is the wrong aspect.
- Manual crop UI is optional follow-up; v1 is tracking + inspect in the player.
- Subject detector may be a vendor; we still own the clip field and the job row.

## Rejected

- Virality scores / ClipAnything as the product.
- Shipping letterboxed 9:16 as “good enough” for talking-head ads.
- Eye-contact gaze warp as a companion feature.
