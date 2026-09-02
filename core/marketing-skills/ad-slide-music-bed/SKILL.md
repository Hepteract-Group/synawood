---
name: ad-slide-music-bed
description: After slide backgrounds, generate_music on the audio track. A silent carousel is unfinished.
category: slides
locked: true
---

# Slideshow music bed

Brand (non-negotiable): use this project's Brand Studio — logo, primary/accent, fonts, CTA, claims. Do not invent a palette. Do not fake product UI. Path C / set_slide carries headlines; generated pixels are scenes, not typography.

## Rules

- After `plan_slideshow` and `generate_slide_background` on every slide, call `generate_music` unless a music bed is already on the audio track.
- Instrumental only (`forceInstrumental` true). `placeOnTimeline` true. `durationSeconds` covering the slideshow (`projectSummary.durationSeconds`).
- Prompt the bed to the Brand Studio mood (calm, premium, not meme). Do not sing product claims.
- Skip `duck_music` unless this project has voiceover. Still-led carousels need a bed under the picture, not under speech.
- Paid: pass `confirmSpend` when the estimate is > £0. Do not skip music to save a chat sentence.
- The operator can also ask in chat ("add background music") — same tool. Audio tab → Generate music bed is the manual path.

## Tools

Use Studio Tools only (`generate_music`). No shell, no vendor CLIs, no skills.sh scripts.
