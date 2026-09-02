# ADR-0049 — Direct a 30–120s branded ad (the product)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision **2I** · Plan index **25** · Epic [#512](https://github.com/Hepteract-Group/marketing-os/issues/512)  
**Related:** ADR-0047 (footage library), ADR-0048 (text-to-video and image-to-video), ADR-0050 (photo + prompt → video), ADR-0006, ADR-0044  
**Amends:** ADR-0002 (Remotion is a tool, not the product), ADR-0005 (a generated file may become the Final if it meets this contract), ADR-0014 (length ceiling for this format is **120s**, not 60s)

**Amended by [ADR-0051](./0051-agent-watches-the-player.md):** The customer does not switch off “Edit only” to get an ad. The agent must watch the player (cut review) before it can finish. No user-facing recipes.  
**Amended by [ADR-0070](./0070-studio-operators-are-a-marketing-team.md):** Operators are a marketing team, not a single founder. Live co-edit still vetoed.

## The product (read this first)

A **marketing team** tells the Studio Agent: **make a 30 to 120 second ad.** (Operators, not a single-seat product — [ADR-0070](./0070-studio-operators-are-a-marketing-team.md).)

It must come back with **one ad** you can Approve that has all three:

1. **Video** — moving picture. Uploaded footage, generated video, or both.
2. **Music** — a bed under the picture (generate or reuse).
3. **Brand** — this product’s look and claims: Brand kit (logo, colors, type), Brand DNA, Catalog, `product-marketing.md`. Not generic stock.

That is the goal. It is not optional. Missing video, missing music, or missing brand means the job failed.

Length: the operator names **30–120 seconds**. If they say “make an ad” with no length, default **30s**. Longer than 120s is out of v1.

The agent must use what it already knows about the brand. It must not ask the team to paste a style guide that already lives on the Product.

## How is not the product

The founder does not care whether the file was:

- many short clips plus music, then encoded, or
- one longer text-to-video, then music and logo applied, or
- **image-to-video from a photo you attached** (ADR-0050), then music, or
- Remotion, FFmpeg, or a vendor encode.

Pick whatever produces the ad. **Do not refuse** because “we only export from Remotion” or “clips are max 8 seconds.” If a model can generate 15–30s of video, use it. If it can only do 4–8s, generate several clips and join them until the ad is the requested length.

Remotion stays useful for preview, captions, and logo-on-export when the timeline is the source of truth. It is **not** a reason to withhold a complete ad.

## Still required (not the goal, the guardrails)

- Estimate cost. Confirm when £>0. Banner while jobs run. Survive reload.
- Video generation stays **off** on **Edit only** (`founder-edit`) until they switch to Draft / Standard / Best quality (no surprise spend).
- Approve is still Approve. Publish is still Publish.
- Claims stay inside Catalog / DNA. Invented proof is a fail.

## What we are not building

- A 10-minute film.
- An unbranded clip with no music called “the ad.”
- A second product besides Studio.

## Plan 25

Assembly tools (ADR-0047) and live video (ADR-0048) exist to serve **this** contract. If a slice does not help “make a 30–120s branded ad with video + music,” it is the wrong slice.
