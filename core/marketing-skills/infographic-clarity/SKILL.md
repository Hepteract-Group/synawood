---
name: infographic-clarity
description: Structure carousel and TikTok slideshow posts — one idea per slide, scannable headlines, photographic backgrounds. Use when planning slideshows, carousels, or infographic Final packs.
category: slides
locked: true
---

# Infographic / slideshow clarity

Brand (non-negotiable): Brand Studio logo, colors, fonts, CTA, claims. No invented palette. No fake product UI.

## Rules

- One idea per slide. Slide 1 = hook; middle = proof/steps; last = CTA.
- Headlines scannable in under 2 seconds; avoid paragraph body on TikTok/IG Story presets.
- Prefer Remotion/Path C text over text painted into AI images.
- Real product UI → Brand kit stills, never invented chrome.
- 5–7 slides default; stay within preset min/max.
- Optional VO: one short line per slide; don't overtalk.
- **Never ship a finished carousel as brand-color rectangles plus type.** After `plan_slideshow`, call `generate_slide_background` on **every** slide with a real scene (editorial photo, product-in-hand, problem visualization). Variety of scenes. Variety of layouts.

## Slide layouts — assign these deliberately

Each slide has a `layout` field that controls the Remotion visual template:

| layout | When to use | Visual treatment |
|--------|-------------|-----------------|
| `hero` | **Slide 1 only** — the hook | Oversized headline, accent kicker bar, bottom-anchored text |
| `point` | Numbered steps, benefits, features | Accent chip number, bold headline, optional frosted body panel |
| `stat` | A single striking number or percentage | Giant accent-colour stat, support line below |
| `quote` | Social proof, testimonial, or bold claim | Decorative large open-quote, italic serif headline, attribution |
| `cta` | **Last slide** — call to action | Solid brand-primary fill, centred headline, logo lockup |

Auto-assignment rules (applied by `plan_slideshow`):
- Slide 1 → `hero`, last slide → `cta`, middle slides → `point` / `stat` / `quote` (rotated for variety).
- Override with `set_slide layout: "stat"` whenever a slide leads with a number (e.g. "3× faster", "10,000 users").
- Use `quote` when the headline is a testimonial or pull-quote.

## Tool hints

- `plan_slideshow` on **this** project — do not `create_project` for a carousel on a Video Suite cut.
- After planning, `generate_slide_background` on every slide, then `generate_music` (instrumental bed on the audio track) unless music is already there. `set_slide layout` on number-led slides.
- Fix copy with `set_slide` before regenerating images.
- Prefer `render_export` targets `stills` first when budget-tight; add MP4 when motion helps.
