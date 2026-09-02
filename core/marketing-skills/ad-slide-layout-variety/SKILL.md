---
name: ad-slide-layout-variety
description: Mix overlay and compartment slides. Never leave every middle slide as point or as overlay.
category: slides
locked: true
---

# Layout variety

Brand (non-negotiable): use this project's Brand Studio — logo, primary/accent, fonts, CTA, claims. Do not invent a palette. Do not fake product UI. Path C / set_slide carries headlines; generated pixels are scenes, not typography.

## Rules

Repetition looks templated. Overlay (type on a photo) stays. Also use compartments.

- After plan_slideshow, keep a mix: overlay hero/cta plus at least one stacked band and one left/right split.
- Overlay ids: hero, point, stat, quote, cta.
- Compartment ids: stack_media_top (photo above type on a solid field), stack_type_top (type above a rounded image card), split_media_left, split_media_right.
- Image or type can sit in any compartment. Do not put every headline as overlay on a full-bleed photo.
- Nested tables stay a generated infographic in the media card — do not invent a spreadsheet layout id.
- Distilled from anthropics/skills pptx layout patterns plus converting carousel packs (stacked bands, split columns).

## Tools

Use Studio Tools only. No shell, no vendor CLIs, no skills.sh scripts.
