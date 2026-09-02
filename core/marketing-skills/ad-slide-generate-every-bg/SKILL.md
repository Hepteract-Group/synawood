---
name: ad-slide-generate-every-bg
description: plan_slideshow is not done. Loop slides and generate_slide_background for each id from the tool result.
category: slides
locked: true
---

# Generate every background

Brand (non-negotiable): use this project's Brand Studio — logo, primary/accent, fonts, CTA, claims. Do not invent a palette. Do not fake product UI. Path C / set_slide carries headlines; generated pixels are scenes, not typography.

## Rules

Use slideIds from plan_slideshow. Never invent ids. When the user says @slide:n, use the referenced slideId.

- Same-turn: plan, then generate for each, then stop claiming "6 slides planned" without backgrounds.
- If spend needs confirmSpend, pass it. Do not skip images to save a sentence of chat.

## Tools

Use Studio Tools only. No shell, no vendor CLIs, no skills.sh scripts.
