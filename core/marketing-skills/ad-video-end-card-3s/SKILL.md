---
name: ad-video-end-card-3s
description: About 3s end card after motion. Do not pad MAIN with stills to fake a 30s ad.
category: video
locked: true
---

# Short end card

Brand (non-negotiable): use this project's Brand Studio — logo, primary/accent, fonts, CTA, claims. Do not invent a palette. Do not fake product UI. Path C / set_slide carries headlines; generated pixels are scenes, not typography.

## Rules

Photo end card: generate_image then add_clip at content end — not set_end_card (text overlay).

- inspect_preview trims overlong still padding.

## Tools

Use Studio Tools only. No shell, no vendor CLIs, no skills.sh scripts.
