# Model registry — pick-and-choose

You can mix models per role. Creative Studio does **not** bind to a single vendor. The Vercel AI SDK (+ AI Gateway where useful) is the **uniform call surface**; a **Model Profile** is the selectable combination.

See [ADR-0007](../adr/0007-model-profiles.md).

## Roles

| Role | SDK surface (typical) | Purpose |
|---|---|---|
| `reasoner` | `streamText` / `generateText` | Studio Agent tool loop |
| `image` | `generateImage` | Stills, infographic bases |
| `video` | `experimental_generateVideo` | Short clip assets |
| `speech` | `generateSpeech` or TTS adapter | Voiceover |
| `transcribe` | `transcribe` / Whisper adapter | Speech-to-text on audio/video |
| `caption` | `generateText` + image parts (VLM) | Asset-intelligence captions + tags (Wave 2C / #169); also Analyze-on-index (ADR-0053) |
| `embed_visual` | embedding API (multimodal) | Shot keyframe + text query, same space (Wave 2J / ADR-0052) |

Text embed for captions remains pinned `openai/text-embedding-3-small` (1536-d, #166/#515) — not a profile role.

**Visual pin (#581):** `embed_visual` → `google/gemini-embedding-2` at **1536-d** (`providerOptions.google.outputDimensionality = 1536`, Matryoshka). Native Gemini Embedding 2 is 3072-d; we pin 1536 so visual rows fit the existing `vector(1536)` column without resizing text. `ci-stub` uses `mock-embed-visual` and `mockVisualEmbedding` of that dim. `kind=text` and `kind=visual` are **different spaces** — never cosine-mix them even though both are 1536-d. Caption-then-`text-embedding-3-small` is not this role.

## Model Profile

```ts
// Conceptual
type ModelProfile = {
  id: string
  label: string
  reasoner: ModelRef
  image: ModelRef
  video: ModelRef
  speech: ModelRef
  transcribe: ModelRef
  caption: ModelRef
  embed_visual: ModelRef
  /** Optional cost multipliers / max clip seconds */
  limits?: { maxVideoSeconds?: number; maxImagesPerJob?: number }
}

type ModelRef = {
  /** AI SDK model id or gateway id, e.g. 'fal/…', 'google/veo-…' */
  modelId: string
  providerOptions?: Record<string, unknown>
}
```

Stored in:

- **System defaults** — `core/creative/model-profiles/` (committed starters)
- **Product overrides** — `products/{name}/config` or Studio settings
- **Per-project / per-job override** — founder picks a profile (or role swap) in Studio UI before generate

## Selection UX

- Studio chat: **Reason** / **Image** / **Video** dropdowns beside Send.
  - **Image** maps onto a persisted **Model Profile** (`model_profile_id`) — tools, limits, gen models.
  - **Reason** persists independently as `reasoner_model_id` (null = use the profile’s reasoner). Curated Gateway allowlist only.
  - **Video** persists independently as `video_model_id` (null = use the profile’s video). Curated Gateway allowlist; **family adapters** (ADR-0084). Wan 3.0 (`alibaba/wan-v3.0-video`) and MiniMax H3 / H3 Max land after adapter + smoke ([ADR-0093](../adr/0093-minimax-h3-video-family.md)). Per-family max clip seconds and stills — do not cap a 30s vendor at Veo’s 8s (ADR-0048 / 0084). **Live / Remapped / Frozen** (ADR-0085). Catalogue: [ux/model-catalogue.md](../ux/model-catalogue.md).
- Studio Settings / Brief may still pin a profile for weekly batch cost control.
- Advanced: override a single role for one Generation Job (“use Kling i2v for this B-roll”).

## Resolver

```ts
const resolveModel = (profile: ModelProfile, role: Role): LanguageModel | ImageModel | VideoModel =>
  // map profile[role].modelId → AI SDK / gateway model instance
```

Generators **never** import a hard-coded provider SDK at call sites — only the registry/resolver does.

## Starter profiles

Internal ids stay in the registry. **Labels** are what the founder sees.

| Label | Id | Intent |
|---|---|---|
| Edit only | `founder-edit` | Chat + voice + music. Image and video generate off. |
| Draft | `cheap-draft` | Cheaper stills; short clips when video is live. |
| Standard | `balanced` | Mid-cost stills; default when generating pictures. |
| Best quality | `high-fidelity` | Costlier stills for Final candidates. |
| Tests (no spend) | `ci-stub` | CI only. Hidden from Campaign picker. |
| Profile | Intent |
|---|---|
| `cheap-draft` | Fast/cheap reasoner + cheaper image; video stub or shortest clip; for iteration |
| `balanced` | Default weekly shipping — live short clips |
| `high-fidelity` | Best available image/video for Final candidates (still Remotion-assembled) |
| `broll-live` | Video: Live clips switch — same starter Veo id, image still on |
| `founder-edit` | Reasoner + STT + TTS only; video/image gen disabled — talking-head polish |

Profiles declare **which tools are enabled** (e.g. `founder-edit` hides `generate_video_clip`).

## Rules

- Changing profile mid-project is allowed; new Generation Jobs use the new refs; old assets stay.
- Every Generation Job snapshots `profileId` + per-role `modelId` for replay/cost.
- If a model lacks reference-image support, adapter sets `brandRefsUnsupported` and Path C remains mandatory ([brand-in-media.md](./brand-in-media.md)).
