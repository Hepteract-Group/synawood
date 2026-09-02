# Model catalogue (UX)

Operator-facing list of **supported** Reason / Image / Video models: when to use which, Live vs Frozen, £ hint. Behaviour contract: [ADR-0084](../adr/0084-gateway-model-families.md), [ADR-0085](../adr/0085-catalog-freeze-and-remap.md). Visual: [ui/model-catalogue.md](../ui/model-catalogue.md). Architecture: [gateway-catalog.md](../architecture/gateway-catalog.md).

## What they see

A **page** (Settings or Studio help) plus a **Model choices** link in the chat session row (Session / Ledger / Allow paid models). Not a 200-row dump. Not git markdown.

Grouped by role. Each row:

- Plain-English name (picker label)
- One line **Use when**
- Caps: max seconds, stills, video refs (video)
- £ estimate (living, not invoice)
- Badge: **Live** | **Frozen** (Remapped ids show as Live under the new name; old string is not listed)

Frozen: row visible, **cannot select**, copy: “This model is gone from Vercel — no spend.” Same sentence in chat if they still had it selected.

## Use-when (v1 copy)

| Label | Use when |
|---|---|
| Veo 3.1 Fast | Short 4–8s B-roll, one still, physics-y motion |
| Veo 3.1 | Same, higher quality / cost |
| Seedance 2.0 Fast / 2.5 | Longer clip, many product stills, wardrobe changes |
| Wan 3.0 | Same character or product in a new scene; longer than Veo |
| Fast / Better pictures (Gemini) | Cheap or stronger stills / infographic bases |
| Grok pictures | Alternate stills vendor (canonical `spacexai/` id) |
| Cheap / Best pictures (Seedream) | Draft vs Final-candidate stills |

## Cannot miss

- Frozen is disabled + sentence, not a greyed icon with no copy.
- Picker row stays one line of dropdowns. Catalogue is **Model choices** in the session row, not a 10px `?`.
- Reload: status from server/snapshot, not a client flag.

## Non-goals

- Auto-listing every Gateway id.
- Provider marketing pages as our copy.
