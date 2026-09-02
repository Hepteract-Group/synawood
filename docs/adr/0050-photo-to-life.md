# ADR-0050 — Bring a photo to life (image + prompt + duration)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision **2I** · Plan index **25** · Epic [#512](https://github.com/Hepteract-Group/marketing-os/issues/512)  
**Related:** ADR-0048 (live video adapter), ADR-0049 (full ad), ADR-0023 (Campaign Animate is one UI for the same generator)  
**Does not replace:** ADR-0049. This is a second, equally required action: animate **this** image.

## The product (read this first)

You give the agent:

1. **An image** — upload, Media bin, or `@asset`. Example: a model wearing the clothes.
2. **A prompt** — what should happen. Example: “Walk down a runway with flashing lights.”
3. **A length** — however many seconds you ask for (v1: 2–120s).

You get back **video of that photo in motion**, following the prompt, for that length. The image is the first frame / identity. The prompt is the action. It should look like the photo came alive, not like an unrelated clip.

That is required. It is not “nice if the campaign pack Animate button exists.”

## How

`generate_video_clip` in **image-to-video** mode: `sourceImageAssetId` + prompt + `durationSeconds`. Brand kit / DNA still bind the prompt (logo, look) unless the founder is clearly doing a one-off fashion/product shot from the photo they attached.

If the video model’s max clip is shorter than the length you asked for (many vendors are ~4–8s):

- Generate the first clip from the photo.
- Continue: use the **last frame** of that clip as the next start image, same prompt, until total duration matches.
- Put the clips in order on the timeline. Do not stop at 4s and call a 20s request done.

**Multiple stills (#603):** first still is the first frame / identity. Remaining stills are references, in `@asset` order, up to the **active model’s** max (Veo 1, Seedance 2.0 Fast 9, Seedance 2.5 50). Over the cap, `generate_video_clip` fails **before** spend so the user can drop extras. Do not silently drop stills.

**Tagged video clips (#610):** a mentioned `@asset` video is a Seedance `inputReferences` clip (`[Video n]`), not a dropped extra. Veo (max 0 video refs) fails **before** spend. Audio / other kinds fail the same way. Never silently drop a tagged file.

**Collection looks (#612 / [ADR-0054](./0054-collection-looks-i2v.md)):** two or more tagged stills are extra garments/looks that must appear in the clip. Do not prepend the one-photo identity lock in that case. One tagged still still uses identity lock.

Confirm spend when £>0. Banner while it runs. Survive reload. Place the result on the timeline (A-roll unless they said B-roll).

Campaign pack **Animate** (ADR-0023) keeps using this same path from `backgroundAssetId`. Studio chat is the general path: any image, any prompt, any length in range.

## Guardrails

- **Edit only** (`founder-edit`): video off until they switch to Draft / Standard / Best quality (same as ADR-0048).
- No image → this mode does not run; use text-to-video (ADR-0048) or ask them to attach a photo.
- Claims in the prompt still cannot invent Catalog-breaking proof.

## Not this

- Ignoring the photo and generating from text only.
- Ignoring the prompt and doing a generic Ken Burns pan.
- Returning a still.
- Capping at 8s when they asked for 20s without continuing.
