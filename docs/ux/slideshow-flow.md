# UX — Slideshow / infographic flow

Founder flow for Instagram carousel and TikTok-style slideshow posts. Architecture: [../architecture/slideshow-infographics.md](../architecture/slideshow-infographics.md).

## Flow D — Slideshow pack

1. From Content week board: new slot → format **Carousel / Slideshow** → pick preset (`ig_carousel_1080`, `tiktok_slideshow_9x16`, …).
2. Studio opens with composition `social_carousel` or `vertical_slideshow`; chat primed with channel skill + `infographic-clarity`.
3. Agent proposes slide outline (headlines). Founder edits in chat or slide list (“merge 3 and 4”, “stronger hook on slide 1”).
4. Generate backgrounds (or use Brand kit stills). Preview: **slide strip** + large current slide (Player shows still or timed slideshow).
5. Optional: enable voiceover → hear sync; adjust per-slide duration.
6. Export **Stills** / **MP4** / **Both** → review candidates.
7. Approve → Final pack on slot; copy caption/alt into Draft pack; Phase 0–1 manual upload to IG/TikTok.

## Studio UI additions (slideshow mode)

Slideshow mode runs in the **same editor shell** (ADR-0016: media bin | player | chat over a full-width strip). The mode-specific change is the left bin and the bottom strip:

```
┌───────────┬───────────────────────────┬──────────────────────┐
│ Slide bin │ Current slide preview     │ Chat                 │
│ (outlines,├───────────────────────────┤                      │
│  bg gen)  │ Export: Stills·MP4·Both   │                      │
├───────────┴───────────────────────────┴──────────────────────┤
│ Slide strip (reorder, per-slide duration) — replaces NLE     │
└──────────────────────────────────────────────────────────────┘
```

- Slide strip is the primary timeline metaphor in this mode (not multi-track NLE); it occupies the same full-width bottom region.
- The left bin swaps to slide/outline content (backgrounds, generated stills) instead of the Media tabs.
- Editing headline/body should feel instant (Path C props) without re-running image gen.
- Regenerate defaults to **current slide background only**, not the whole deck.

## States

Same vocabulary as other Studio work (`drafting` → `rendering` → `needs_review` → …). While generating N backgrounds, show per-slide job chips (`slide 3/7 generating`).
