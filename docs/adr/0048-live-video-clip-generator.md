# ADR-0048 — Live video generation (text-to-video and image-to-video)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision **2I** · Plan index **25** · Epic [#512](https://github.com/Hepteract-Group/marketing-os/issues/512)  
**Product goal:** [ADR-0049](./0049-direct-branded-ad.md) — a 30–120s ad with video, music, and brand.  
**Operator runbook:** [broll-assembly.md](../../core/runbooks/broll-assembly.md).  
**Related:** ADR-0006 (brand in the prompt), ADR-0007 (Model Profiles), ADR-0018 (spend + QC), ADR-0023 (Campaign Animate), ADR-0047, ADR-0050 (photo + prompt)  
**Un-defers:** Plan 03 video slice and the video half of [#20](https://github.com/Hepteract-Group/marketing-os/issues/20).

**Amended by [ADR-0051](./0051-agent-watches-the-player.md):** Do not ship “Live clips” as a customer mode. Video generate is on for SaaS (confirm when £>0). `founder-edit` is a local/dev kill-switch, not the product default. If a picker exists, list model names.  
**Amended by [ADR-0084](./0084-gateway-model-families.md):** Video generate is **family-adapter** first (Veo vs Seedance vs Wan 3). Do not cap Wan 3 at Veo’s 8s. Do not apply Seedance `[Image n]` tokens to every live id. Add-model: adapter → live smoke → picker.

## Context

`generate_video_clip` is a mock and is off on `founder-edit`. The ad (ADR-0049) needs real moving picture: text-to-video and image-to-video.

## What “profile” means

A **Model Profile** is a named spend preset. Internal ids stay stable; **labels** are what the founder sees.

| Label (shown) | Internal id | What it is |
|---|---|---|
| **Edit only** | `founder-edit` | **Default.** Chat, captions, voice, music. Image and video generate **off**. |
| **Tests (no spend)** | `ci-stub` | Tests/CI only. Hidden from Campaign picker. |
| **Draft** | `cheap-draft` | Cheaper stills. |
| **Standard** | `balanced` | Mid-cost stills. Live short clips on (confirm spend). |
| **B-roll live** | `broll-live` | Dedicated Video: Live clips switch (#517). Same starter Veo id as Standard / Best quality. |
| **Best quality** | `high-fidelity` | Costlier stills. Live short clips on. |

Studio Image dropdown uses **Off — edit only**, **Fast pictures**, **Better pictures**, **Grok pictures**, **Cheap pictures**, **Best pictures**.

To make a 30s ad or photo-to-life, switch off **Edit only** to **Draft / Standard / Best quality**, then confirm spend. That is a safety switch, not a product limit.

## Decision

### 1. Two ways to generate video (both required)

| Mode | When | Input |
|---|---|---|
| **Text-to-video** | No photo, or they asked for video from words | Prompt, bound to brand |
| **Image-to-video** | They attached/chose a photo and said what should happen (ADR-0050). Also Campaign Animate (ADR-0023). | **That photo** + prompt + duration |

**Photo + prompt is a first-class request.** Example: photo of a model in the clothes + “walk down a runway with flashing lights” + 12s → video of that model walking, that long. Do not drop the photo. Do not ignore the prompt. See [ADR-0050](./0050-photo-to-life.md).

Prompts must include Brand kit / DNA / Catalog, not a generic “product ad” sentence.

### 2. Length: enough video to make the ad

The **ad** is 30–120s (ADR-0049). One generate may be shorter than that. Then generate more (or use library shots) until the timeline is the requested length.

If the model allows a longer clip (15–30s+), use it. Do not cap at 8s when the vendor can do more. Profile `maxVideoSeconds` is a spend/safety cap we raise to match the vendor, not a product slogan.

### 3. Jobs, not a frozen chat

Video is slow. Enqueue a Generation Job, show a banner, poll, survive reload. QC: real MP4, duration present. Index the new clip so the next search can find it.

### 4. Who can spend

| Profile | Video generate |
|---|---|
| Tests (`ci-stub`) | On, fake file, £0 |
| Edit only (`founder-edit`) | **Off**. Switch profile to spend. |
| B-roll live (`broll-live`) | On. Confirm when £>0. Default 4s, max 8s. |
| Standard / Best quality | On. Confirm when £>0. |

### 5. #20 split

[#20](https://github.com/Hepteract-Group/marketing-os/issues/20) is **MCP only**. Postiz moved to [#787](https://github.com/Hepteract-Group/marketing-os/issues/787) / ADR-0063. Video is this ADR + #512.

## Rejected

- Treating text-to-video as optional.
- Image-to-video that drops the photo or ignores the prompt (ADR-0050).
- Unbranded prompts.
- Surprise spend on **Edit only** (`founder-edit`).
- Blocking chat on a long diffusion call.
- Waiting on MCP or Postiz before the first real clip.
