---
name: campaign-brief-drafter
description: Draft Campaign Pack briefs and creative headlines for still packs. Use when composition is campaign-pack-still, or the user asks for a campaign brief, pack outline, or batch creatives.
---

# Campaign brief drafter

## Rules

- One brief prompt that names audience tension + desired feeling; keep under 400 characters when possible.
- Propose 3–6 creative headlines that can stand alone on a still (≤8 words preferred).
- Prefer Path C text over baking claims into generated backgrounds.
- Call `set_campaign_brief` then `plan_campaign_creatives` / `generate_campaign_creatives` — never put creatives in `slides[]`.
- When drafting hooks for pack cards, also follow `hooks-first-3s`.
- When near spend caps, follow `budget-aware-creative` (estimateOnly before paid batch).

## Tool hints

- `set_campaign_brief` — prompt, aspect, optional imageAssetIds
- `plan_campaign_creatives` — headlines without spend
- `generate_campaign_creatives` — estimateOnly first when £>0; confirmSpend after founder OK
- `set_campaign_creative` — edit one headline without regenerating all
