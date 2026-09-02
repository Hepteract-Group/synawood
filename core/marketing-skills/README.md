# Marketing skills (core)

Modular GTM craft for the **Studio Agent** (and for coding agents editing marketing work).

Not engineering skills — those live in `.agents/skills/`.

Design: [`docs/architecture/marketing-skills.md`](../../docs/architecture/marketing-skills.md) · [ADR-0008](../../docs/adr/0008-marketing-skills-for-studio.md) · specialists [ADR-0031](../../docs/adr/0031-multi-agent-as-skills.md)

## Packages

Add one folder per skill with `SKILL.md`:

- `hooks-first-3s`
- `budget-aware-creative`
- `infographic-clarity` — carousel / TikTok slideshow (`docs/architecture/slideshow-infographics.md`)
- `ad-slide-*` (locked) — high-conversion carousel craft; distilled from skills.sh research (pptx, hyperframes slideshow, copywriting). Instructions only. Brand Studio still wins. Includes `ad-slide-music-bed`.
- `ad-video-*` (locked) — video ad craft; distilled from skills.sh research (faceless-explainer beats, launch beat sheets, captions). No vendor CLIs.
- `director-vibes` — curated Director styles (`premium`, `energetic`, `urgent`, `cinematic`, `informative`)
- `editor-cuts` — pacing / pack / trim rules for timeline suggestions
- `talking-head-first-pass` — ordered polish for a presenter take (ADR-0073)
- `motion-variety` — kinetic / authored motion first pass (write_composition, no talking-head fallback)
- `copywriter-hooks` — hook + CTA patterns
- `campaign-brief-drafter` — Campaign Pack briefs + creative outlines
- `claim-vs-catalog` — reject/rewrite unverified claims before ready
- `ad-constitution` — locked operating principles for every make-ad turn (Wave **2N** / ADR-0092)
- `audience-awareness` / `single-minded-proposition` / `visual-proof` / `cognitive-economy` / `concept-diversity`
- `marketing-critic` — inspect_preview only (not chat)
- `channel-linkedin` / `channel-x` / `channel-tiktok` (planned)
- `founder-story-batch` (planned)

Product-specific overlays: `products/{name}/marketing-skills/` (e.g. the private example `privacy-claim-safety`).

Loader: `specialistPack()` / `selectMarketingSkills()` in `core/creative/src/agent/skills/`.
