# Creative Studio (system view)

Creative Studio is a **Synawood product surface**: chat-to-timeline editing that produces Final assets for the Content pipeline. Purpose: replace freelance **editors and motion designers** so a **marketing team** can ship standard 30–120s branded ads — talking-head **and** motion graphics (ADR-0049, ADR-0070, ADR-0091). Not a one-founder toy. Not live multiplayer.

> ≤60s is a **ceiling** for channel fit, not a fixed canvas: project duration is dynamic per project (ADR-0014). A 10s cut renders as 10s, not 10s plus 50s of dead air.

## Shape

Architecture is **B** (agent + Studio Project + Remotion). The workspace is a full-viewport editor (chat right, media bin left, full-width timeline — ADR-0016). The agent may author Remotion composition source in a sandbox ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)). What it *chooses* to make follows the creative constitution ([ADR-0092](../adr/0092-creative-constitution.md)) — audience, one idea, proof — as skill packs, not extra agents. Overlap with other editors is not a reason to refuse craft. See plan track and [architecture](../architecture/README.md).

## Inputs

- Product marketing context + Brand kit
- **Product Extracts** — scored public-site stills and copy on the Product ([ADR-0089](../adr/0089-product-extracts.md))
- Brief / channel / length
- Optional talking-head / product footage from the team
- Operator chat instructions (“bigger hook”, “cut silence”, “generate B-roll of …”)
- Generator outputs — AI images, short video clips, TTS audio (see `docs/architecture/generators.md`)

## Outputs

- Preview in dashboard
- Generated assets in the asset store (stills, clips, audio). **AI Media** (`/ai-media`) is where those jobs will be reviewed and placed into Studio (ADR-0061 / 0062; UI in Plan 28).
- Render Job → composed MP4 and optional PNG/infographic stills
- On Approve → Final asset in `content/drafts/{week}/final/`

## Brand in media

Brand kit assets must appear in generated images/video **and** on Final exports. Three paths — prompt binding, reference conditioning, Remotion chrome — are specified in [`docs/architecture/brand-in-media.md`](../architecture/brand-in-media.md). Soft prompts alone are not enough; Path C chrome is the correctness floor for v1.

## Media path (generate → assemble)

1. **Set brand** — Brand Studio (upload/edit) or optional `import_product_brand` from the Product Brand Library onto the Studio Project.
2. **Plan (paid generate)** — Agent drafts a **Generation Plan** (scenes, dialogue, models, £). Operator edits and confirms spend ([ADR-0086](../adr/0086-generation-plan-and-artefacts.md)). Skip when video/image gen is off.
3. **Generate** — Image / Video Clip / TTS / Transcription Generators create assets with BrandPromptContext + refs (async Generation Jobs when slow). Family adapters + freeze ([ADR-0084](../adr/0084-gateway-model-families.md), [ADR-0085](../adr/0085-catalog-freeze-and-remap.md)).
4. **Assemble** — Studio Agent places assets on the Studio Project **or** writes **composition source** (kinetic type, Lottie, 3D, transitions — ADR-0091). Path C chrome still wraps the tree.
5. **Export** — Remotion Render Job encodes the compiled composition (preset or authored) and produces the channel-ready candidate.
6. **Approve** — human promotes to Final asset in Blob + DB (git pointer optional).
7. **Publish** — paste URL always; Schedule via Postiz after Approve — see `docs/architecture/distribution-and-postiz.md` (Plan 29 / ADR-0063).

## Persistence

Studio parallel track requires **Azure Blob + Supabase** from first generate/export — not a Phase 2 deferral. Details: `docs/architecture/storage-and-persistence.md`.

## Local-first

All Studio/dashboard work must run on **localhost** for review before Vercel. See `docs/architecture/local-first.md`.

## Non-goals (v1 system)

- Auto-posting
- Unsandboxed model TSX in the dashboard origin or render worker (ADR-0091 — authored TSX **in the sandbox** is in-scope)
- Replacing the team’s recording session or Phase 1 funnel work
- Live multi-editor on the timeline (ADR-0070)
- A second named “Producer / Quick Design” recipe (ADR-0073)
- Shipping raw Generator MP4s as Final assets with no assembly/Approve
- Dumping Vercel’s full Gateway catalog into the picker (ADR-0007 / 0084)
- A Cursor-style writable filesystem in Studio (ADR-0086 — Artefacts pane is a view)
