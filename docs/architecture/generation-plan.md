# Generation Plan and Artefacts

Contract: [ADR-0086](../adr/0086-generation-plan-and-artefacts.md). Does not replace [ai-director.md](./ai-director.md) (DirectorPlan = edit diff). Intent/scenes: [intent-and-scenes.md](./intent-and-scenes.md). Spend: [pricing-and-cost.md](./pricing-and-cost.md), [billing.md](./billing.md).

## Generation Plan

A structured document **on the Studio Project** (ADR-0003). Answers: what we will generate, what people say, which models, how much £ — **before** Gateway image/video.

```ts
type GenerationPlan = {
  id: string
  status: 'draft' | 'ready' | 'applied' | 'stale'
  goal?: string
  angle?: string
  tone?: string
  audience?: string
  runtimeSeconds?: number
  platform?: string
  scenes: Array<{
    id: string
    role?: string
    description: string
    durationSeconds?: number
    dialogue?: string
    onScreenText?: string
  }>
  assetIds?: string[]
  extraExtractUrls?: string[]
  reExtractThisTurn?: boolean
  reasonerModelId?: string
  imageModelId?: string
  videoModelId?: string
  costEstimateGbp: number
  projectRevision: number
}
```

Markdown in the UI is a **projection**. Zod is source of truth. Spoken lines = `dialogue` / voiceover, never “script.”

### Tools

| Tool | Mutates timeline? | Gateway generate? |
|---|---|---|
| `draft_generation_plan` | no | no |
| `update_generation_plan` | no | no |
| Apply + confirmSpend (operator or `apply_generation_plan`) | no until generate | yes, after confirm |

Make-an-ad (ADR-0055): after Apply, `generate_video_clip` (or visible fail). Plan-only chat is not a successful make-an-ad.

Video off / Edit only: plan not required.

Extra URLs + `reExtractThisTurn` (default false) are Product Extracts controls ([product-extracts.md](./product-extracts.md), ADR-0089). Estimate includes crawl + screenshots + vision when those flags are on.

Jobs snapshot `generationPlanId` + canonical model ids (ADR-0085).

## Artefacts pane

Not a filesystem. Not `writeFile`. Tree **view**:

- Generation Plan (fields)
- Installed skills (read-only markdown; toggle stays Settings, ADR-0080)
- Optional brand excerpts already on the project

Guardrails: allowlist views `.md` / `.json`; sanitise markdown; reuse pack executable denylist; ~256 KiB plan cap; dialogue → captions/TTS only.

## Persistence / UX contract

Plan survives reload. Modal on draft + **banner** if dismissed (“Plan ready — confirm to generate”). Local worker missing: banner says so. Status is not a Send label.
