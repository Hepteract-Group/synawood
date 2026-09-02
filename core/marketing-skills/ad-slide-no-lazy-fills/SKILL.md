---
name: ad-slide-no-lazy-fills
description: Treat solid brand-color rectangles plus type as unfinished. Use after every plan_slideshow.
category: slides
locked: true
---

# No lazy fills

Brand (non-negotiable): use this project's Brand Studio — logo, primary/accent, fonts, CTA, claims. Do not invent a palette. Do not fake product UI. Path C / set_slide carries headlines; generated pixels are scenes, not typography.

## Rules

A color block with a headline is a layout sketch, not an ad. People skip it.

- After plan_slideshow, call generate_slide_background on every slide before you say done.
- Backgrounds: editorial photography, product-in-hand, problem-in-the-world — not gradients as the only art.
- Last-slide CTA may use a stronger brand fill, still with a scene or product still behind type.
- If generate_slide_background fails, say so. Do not call the sketch the Final.

## Tools

Use Studio Tools only. No shell, no vendor CLIs, no skills.sh scripts.
