# ADR-0051 — The agent watches the player (one make-the-video loop)

**Status:** accepted  
**Date:** 2026-08-18  
**Wave:** Vision **2I** correction · Epic [#549](https://github.com/Hepteract-Group/marketing-os/issues/549)  
**Related:** [#512](https://github.com/Hepteract-Group/marketing-os/issues/512), ADR-0001, ADR-0003, ADR-0007, ADR-0018, ADR-0046, ADR-0047, ADR-0048, ADR-0049, ADR-0050  
**Amended 2026-08-25 / [#1022](https://github.com/Hepteract-Group/marketing-os/issues/1022):** The same inspect loop applies to **carousel / slideshow**. Picture window is the sum of slide durations, not the 30s composition preset and not a long music clip. An empty tail after the last slide is a failed cut. `inspect_preview` is required after slideshow assemble tools (`plan_slideshow`, `generate_slide_background`, …) the same way it is after video assemble.

**Does not supersede:** ADR-0001 (thin tool loop), ADR-0003 (project JSON is truth), ADR-0049 (the ad is still video + music + brand).  
**Amends:** ADR-0018 (vision review is required, not optional), ADR-0007 (profiles are internal), ADR-0046 / 0047 / 0048 (no user-facing recipes or editor jargon), ADR-0049 (customer does not switch “Edit only” to generate).

**Amended 2026-08-31 (#1329):** `inspect_preview` is required before the agent may **claim the ad is done** or before Approve. It is **not** forced as step 0 of every Execute turn. An operator job (place voiceover, patch type) outranks leftover inspect debt — the force-tool queue is job-scoped ([ADR-0001](./0001-studio-agent-harness.md)).

## The product (read this first)

The customer describes the video they want. They may attach assets, or not.

The Studio Agent builds **that video**. They do not pick a recipe. They do not hop between talking-head and B-roll. They do not learn what a Model Profile is.

When the agent says it is done, the **player** already shows:

1. Moving picture for the whole requested length (default 30s if they did not name a length; max 120s in v1).
2. Music under that picture, same length — never over black.
3. This product’s brand (kit, DNA, catalog, claims).

That is the same contract as [ADR-0049](./0049-direct-branded-ad.md). This ADR is **how** the agent is allowed to finish.

Timeline dragging is a fallback for power users. It is not the happy path. The bar is the same as coding agents: people should not need to edit the video to get a professional result.

## What went wrong on the first run

The agent wrote timeline JSON and never looked at the player.

Generated stills landed on the overlay lane. Overlay defaults to a small corner box. Main was empty, so the player showed **black with a postage-stamp image**. Music played through the holes. No generated video sat on the main picture track.

The customer had no “mode” to read. They only saw a bad video.

Prompting the model to “put it on Main” will not fix this. ADR-0018 already showed prompt patches do not stick. Coding agents work because they **run the code and see the result**. Video needs the same loop.

## Decision

### 1. One job, no customer-facing recipes

There is one product loop: **describe → (optional assets) → agent builds → agent reviews the player → done or fix**.

The software may still have two picture tracks internally (`track_video` = main picture, `track_broll` = overlay). That is an implementation detail.

The agent decides placement from the request and the files present. The customer never names a recipe.

**Forbidden in chat, settings, empty states, and picker labels:** talking head, A-roll, B-roll, PIP (as a product mode), founder-edit, spend profile, Live clips (as a mode).

**Allowed to customers:** video, picture, overlay (only if they asked to put one picture on another), music, captions, brand.

### 2. The agent must see the player before it can finish

“Make a video” / “make an ad” **cannot complete** until a **cut review** passes.

Cut review:

1. Encode cheap stills from the real composition (start, middle, end, plus any second with no picture).
2. Optionally encode a short preview of the whole cut.
3. Send those frames (and the preview when present) to a vision model.
4. The model returns a **structured** critique against a fixed rubric (below). Not a vibe paragraph.
5. Failures come back as tool errors in the **same turn**. The agent must fix and review again. It must not narrate success.

This is a first-class Studio Tool (`inspect_preview` / `review_cut`). It is **required from day 0** for this loop. It is not an optional flag on ADR-0018 item 3.

File QC (bytes exist, duration present) still runs. It is not enough. Bytes that exist can still be a black frame with a tiny still.

Use the existing `caption` / vision role in the Model Profile registry. Do not add a second agent framework.

### 3. Taste is a judge with a rubric, not a personality

Taste is the agent’s job. We make it the job the same way Cursor made “write working code” the job: **a judge the agent cannot skip**.

The critic scores the preview against:

- **Craft:** picture on every second of the requested length; main picture is full-frame unless the customer asked for an overlay; overlay, if used, is large enough to read; music does not outlast picture; “make a video” is not a still in a corner; type is readable; no dead air on the picture track.
- **Brand:** looks like this product (kit / DNA / catalog), not a generic stock ad; claims stay inside catalog.
- **Brief:** matches what they asked for (length, motion, what is on screen).

Optional later: two or three reference ads as a quality bar; generate two cuts and keep the higher score.

Editor craft documents load as Studio skills for the **critic**, not as essays in the chat prompt. Skills without eyes do nothing.

A 2026 vision model will catch black, tiny graphics, missing product, slideshow-not-video, unreadable type. It will not always cut to the beat like a staff editor. That is acceptable. The customer still should not have to open the timeline to fix structure.

### 4. Picture rules live in code (the model cannot skip them)

After any assemble, before cut review:

- Every frame from `0` to the requested length has picture on the **main** video track.
- New generated picture goes on the main track, full-frame, unless the customer asked to overlay it on existing footage.
- Overlay is allowed only when main already has picture.
- Music duration must not exceed picture duration.
- Default overlay size must be readable if overlay is used (news/split scale, not a stamp). One global tiny corner is not a valid default for “the only picture.”

These are post-gates (ADR-0018 item 2). A turn that leaves black while music plays is a failed turn, even if every tool returned `ok`. Slideshows use the same gate: the Remotion canvas must equal the slide sum, and every slide needs a background.

### 5. Cost is credits, not a mode the customer must understand

Model Profiles stay **internal** (ADR-0007 registry: which vendor to call, limits, enabled tools).

Customers see:

- The agent just generates (SaaS default).
- Confirm when the estimate is above £0 (ADR-0018 spend gate stays).
- Optional later: Fast / Standard / Best. Never “Edit only”, “founder-edit”, “balanced”, or “Live clips”.

If a model picker is shown at all, it lists **model names**. A single “Live clips” switch is the same mistake as recipes: a hidden mode the customer cannot interpret.

`founder-edit` (image/video tools off) may exist as a **local/dev kill-switch** in env. It is not the product default and not a customer-facing profile.

“Make a video” on a video-disabled config must **stop and say generation is off**, not fake an ad with stills in the overlay.

### 6. Same harness

One Studio Agent, one project, allowlisted tools, Vercel AI SDK loop (ADR-0001). Generators create assets. Remotion (or another encoder) is how we **see** and export. Seeing is now a required step, not a founder eyeball.

## Rubric (v1 — fail any of these and the turn is not done)

| Check | Fail if |
|---|---|
| Coverage | Any second of the requested length has no picture on the main track |
| Motion | The customer asked for a video and the picture is only stills (unless they asked for a slideshow) |
| Size | The only picture is a small corner overlay on black |
| Audio | Music or voice plays over black |
| Brand | Generic stock look, or claims outside catalog / DNA |
| Brief | Length or subject does not match what they asked |

## What the customer sees

Chat, player, a persistent “working on it” banner while generate/review jobs run (survives reload), then the video.

They never see recipes, talking head, B-roll, founder-edit, or spend profiles.

## Rejected

- User-facing recipes (talking-head vs synthetic vs B-roll assembly).
- Vision review as optional / later / behind a flag.
- Prompt-only “have taste.”
- Making the customer switch Video to “Live clips” or leave “Edit only” to get an ad.
- A second agent framework (LangGraph, crews) to supply taste.
- Calling the overlay lane “talking head” or teaching customers B-roll.
- Declaring success from timeline JSON without looking at frames.

## Consequences

- Epic [#549](https://github.com/Hepteract-Group/marketing-os/issues/549) owns implementation slices: `inspect_preview`, picture-completeness gates, customer cost UX, jargon purge, editor skills for the critic.
- Wave 2I ([#512](https://github.com/Hepteract-Group/marketing-os/issues/512)) still ships the ad; this ADR is the quality bar that assembly must meet.
- CONTEXT.md vocabulary: **cut review**, **overlay** (customer), **picture completeness**. Internal track ids may keep current names.
- Worktrees that already added “Live clips” (`review/broll-local` on :3011) must be folded into this contract: list models or hide the picker; do not keep “Live clips” as a product mode.
