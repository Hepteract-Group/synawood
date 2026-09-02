# Competitive reference: Google Pomelli

> Reference only — informs design quality and one deferred feature. Does not change current scope.

**What it is:** [Pomelli](https://labs.google.com/pomelli) is a Google Labs × DeepMind experiment (Oct 2025) that scans a website URL, builds a **Business DNA** brand profile, and generates on-brand campaign creatives, product photoshoots (Nano Banana), short animations (Veo), brand books, and one-click websites. Free in beta. ([announcement](https://blog.google/innovation-and-ai/models-and-research/google-labs/pomelli/), [review](https://www.buildfastwithai.com/blogs/what-is-google-pomelli-ai))

## Flow (for our UX bar)

`URL → Business DNA → campaign ideas → ~10 creative variations → natural-language edit → download`

- Dark, confident UI; strong typographic hierarchy; creative cards with a download affordance; a single "Add Creative" CTA.
- No direct publishing; English-only; static images + short animation; no review/approval lifecycle, no cost governance, no content board.

## Where it validates our design

| Pomelli | Synawood Studio |
|---|---|
| Business DNA (brand from URL) | Brand Kit (Organization library + Path A/B/C; fixture `products/demo/brand-kit/`) |
| Campaign ideas from DNA | Studio Agent + `core/marketing-skills/` |
| ~10 creative variations | Model Profiles + generator adapters |
| Natural-language edit | Studio Tools via agent harness |
| Photoshoot (Nano Banana) | Image generator (Epic #16) |
| Animate (Veo) | Video generator (Epic #16/#20) |

## Where we already lead

- **Video timeline editing** — Remotion chat-to-timeline (clips, overlays, captions, end cards). Pomelli has none.
- **Review lifecycle** — candidate → Approve/Kill/Regenerate → Final asset → publish records (Plan 05).
- **Funnel / content week board** — GTM infrastructure, not just asset creation.
- **Cost governance** — spend caps, cost ledger, `confirmSpend`.

## What we take

1. **Design-quality bar for generated assets.** Generated creatives should look this good out of the box. Raises the bar on slide-frame compositions (Plan 04) and Path C chrome — **not** a new feature. Tracked on Epic #17.
2. **Brand extraction from URL** — Vision Wave **2B** (Epic #148, [ADR-0027](../adr/0027-ad-generator-and-variants.md), [ad-generator-and-variants.md](./ad-generator-and-variants.md)). Auto-derive an ExtractedBrief / brand seed by scanning a site or PDF — the scalable on-ramp beyond hand-authored kits. Implement per plan 09; not a separate orphan issue.

## What we deliberately do NOT chase

Photoshoot, Animate, the website builder — off-thesis for the video-editor risk-mitigation goal.
