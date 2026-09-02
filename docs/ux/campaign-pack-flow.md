# UX — Campaign pack flow

Founder flow for Campaign Pack stills (Plan 09 / ADR-0021). Architecture: [../architecture/campaign-packs.md](../architecture/campaign-packs.md).

## Flow

1. Open **Campaigns** in the sidebar (`/campaigns`) — not Studio home Slideshow formats.
2. Write a brief, pick aspect + creative count, **Create pack**.
3. Create saves the brief and **generates stills** in the same flow (fallback brand if the Product has no kit yet).
4. Pack detail (`/campaigns/[id]`): creative cards with still previews.
5. Edit one headline inline (saves without regenerating the pack).
6. Select cards → **Generate stills** (first time) or **Regenerate selected** (re-roll backgrounds).
7. **Export** stills → status Needs review → select cards → **Approve**.

DNA / Catalog suggestions are deferred; composer is manual prompt only until that track returns.

## Separate from Slideshow

Slideshow entry stays under Studio create (Carousel / Vertical). Campaigns never reuse `slides[]`.
