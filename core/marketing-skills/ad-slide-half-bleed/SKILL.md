---
name: ad-slide-half-bleed
description: Subject-left / type-right as a real split compartment, not only a cropped overlay.
category: slides
locked: true
---

# Half-bleed / split layouts

Brand (non-negotiable): use this project's Brand Studio — logo, primary/accent, fonts, CTA, claims. Do not invent a palette. Do not fake product UI. Path C / set_slide carries headlines; generated pixels are scenes, not typography.

## Rules

Prefer a real compartment over faking a column with overlay type.

- set_slide layout split_media_left (photo left, type right) or split_media_right (type left, photo right).
- generate_slide_background for the media cell as a scene. Headlines stay set_slide.
- Overlay half-bleed ("subject on the left third") is a fallback when they want type on the photo, not in its own cell.
- Distilled from anthropics/skills pptx two-column / half-bleed patterns.

## Tools

Use Studio Tools only. No shell, no vendor CLIs, no skills.sh scripts.
