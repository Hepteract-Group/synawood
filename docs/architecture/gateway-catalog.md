# Gateway catalog — families, freeze, remap, catalogue

Contract: [ADR-0084](../adr/0084-gateway-model-families.md) (family adapters, add-model flow), [ADR-0085](../adr/0085-catalog-freeze-and-remap.md) (Live / Remapped / Frozen). Profiles: [model-registry.md](./model-registry.md). Video path: [video-generation.md](./video-generation.md). Holding research: `docs/local/gateway-model-expansion.md` (not shipped).

## What it is

Studio does **not** expose Vercel’s full model list. It keeps a **curated allowlist** and, for each live video/image family, a **product adapter** (caps, prompt tokens, preflight) on top of Gateway’s wire API.

Gateway `GET https://ai-gateway.vercel.sh/v1/models` is the presence check. It is not an auto-install feed.

## Add-model flow

1. Family adapter in `core/creative` (isolated module).
2. Local live smoke (`AI_GATEWAY_API_KEY`, spend approved). Pass = bytes + duration.
3. Picker row + catalogue copy. Status from freeze sync.

Never append an id to `GATEWAY_*_MODELS` without (1) and (2).

We do **not** wait for a new Vercel adapter when the Gateway id already exists. Vercel owns routing/billing. We own preflight, tokens, £, jobs, freeze.

## Families (video)

Shared: blob, QC, Generation Jobs, confirmSpend, freeze.

| Family | Gateway ids (v1) | Adapter must encode |
|---|---|---|
| Veo | `google/veo-3.1-fast-generate-001`, `google/veo-3.1-generate-001` | Durations 4/6/8s; max 1 still; 0 video refs |
| Seedance 2.x | `bytedance/seedance-2.0-fast`, `bytedance/seedance-2.5` | `[Image n]` / `[Video n]`; stills/video caps per row |
| Wan 3 all-in-one | `alibaba/wan-v3.0-video` | t2v if no still; i2v if first frame; r2v if refs. Tokens `character1`. Not `wan3.0-video`. Audio/doc input out of v1 unless smoke says otherwise |
| MiniMax H3 | `minimax/minimax-h3`, `minimax/minimax-h3-max` | [ADR-0093](../adr/0093-minimax-h3-video-family.md). H3 4–15s 2K + refs; H3 Max 5–15s 480p/768p t2v+i2v. `minimax/minimax-m3` is the **reasoner**, not video. |

Later families (Kling SKUs, Wan 2.6/2.7 suffix, Grok Imagine Video) follow the same rule. A Veo change must not retune Wan 3.

Image: Gemini `*-image*` stays `generateText` + `result.files`; Seedream / Grok / Flux-class stay `generateImage`. Grok canonical id is `spacexai/grok-imagine-image` (ADR-0085).

Reasoner: allowlist of `tool-use` language models only. No silent fallback (ADR-0055).

## Freeze and remap

| State | Spend |
|---|---|
| Live | confirmSpend when £>0 |
| Remapped | send canonical id |
| Frozen | throw before Gateway; no debit |

Sync: fetch `/v1/models`; mark allowlisted ids. Do not auto-add catalog newcomers.

Surfaces: picker (disabled Frozen), catalogue badge, chat bubble. Not a console log. Not a login freeze.

## Catalogue (data)

In-app page (UX/UI docs) reads the same allowlist + status + when-to-use copy. Not a markdown file in git as the operator surface.

## Tests

- Per family: duration snap, stills cap, token syntax.
- Wan 3 must not emit Seedance `[Image n]`.
- MiniMax H3 must not emit Seedance `[Image n]`. H3 Max preflight rejects extra refs. `minimax/minimax-m3` stays a reasoner.
- Frozen id: generate client not called.
- Remap: `xai/grok-imagine-image` → `spacexai/grok-imagine-image` on the wire.
