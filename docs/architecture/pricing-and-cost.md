# Pricing and cost controls

Generator spend can erase the “avoid freelance editor” win if unbounded. Architecture treats cost as a first-class signal tied to `products/{name}/config.ts` budgets.

**Hosted SaaS:** prepaid organisation wallet, trial video block, and Stripe live in [billing.md](./billing.md) ([ADR-0082](../adr/0082-hosted-billing-wallet-entitlements.md)). This file remains the **usage ledger** (`CostEvent`) and founder-led cap behaviour. Do not add a second ledger.

## Budget anchors (example: Hepteract’s the private example Product)

From product config (illustrative fields already present):

- `monthlyBudgetGbp.freelanceCreative` — Studio should aim to **replace** this line, not exceed it mindlessly
- `monthlyBudgetGbp.tools` — infra/API ceiling
- `monthlyBudgetGbp.experiments` — optional overflow for model tests

Studio adds operational fields (planned):

```ts
creativeBudgetsGbp: {
  monthlyGeneratorCap: number  // hard cap for image+video+tts+reasoner
  weeklySoftCap: number        // warn in UI
  perProjectWarnGbp: number    // e.g. 3–5
}
```

## Cost ledger

Every billable call writes a **CostEvent**:

| Field | Purpose |
|---|---|
| `jobId` / `projectId` / `productId` | Attribution |
| `role` | reasoner \| image \| video \| speech \| transcribe \| caption \| embed \| embed_visual \| analyze \| render |
| `modelId` | From Model Profile snapshot **or** reasoner / video override (`reasoner_model_id`, `video_model_id`) |
| `units` | tokens / images / seconds |
| `estimatedGbp` | Pre-call estimate when possible |
| `actualGbp` | Post-call from provider usage or price table |
| `at` | Timestamp |

**Reasoner turns:** each Studio chat turn that uses a non-mock reasoner writes a CostEvent with `role=reasoner`, the concrete Gateway `modelId`, and a token-based £ estimate (living price table). Mock reasoner writes nothing. Generator tools already attribute `role=image|video|speech|transcribe` with their `modelId`.

Render (Remotion compute) is tracked separately from Generator APIs but shown on the same project cost rollup.

## Asset index metering (#175)

Caption (VLM), transcript, and text embed estimate via `estimateAssetIndexGbp` before enqueue. Soft caps use the same `gateSpend` / `confirmSpend` path as generators.

- **Reindex / Retry** — client sends `confirmSpend: true` (IndexingProgressChip Retry).
- **Upload auto-index** — `allowUnconfirmedPaid: true`; near soft caps the job still writes probe + shots + thumbs + text embeddings, then skip caption and visual (`skipPaidStages` on the job snapshot) so the chip stays recoverable without blocking upload.
- Successful paid stages write **CostEvent** rows (`caption` / `transcribe` / `embed` / `embed_visual`). Analyze writes `role=analyze` after a persisted result (#587).

## Estimate-before-generate

`generate_image` / `generate_video_clip` tools:

1. Look up **price table** for `modelId` (maintained in `core/creative/pricing/` — approximate GBP).
2. Return estimate to the agent/UI.
3. If estimate would breach remaining monthly/weekly cap → tool error: plain English, suggest `cheap-draft` profile or Brand kit stills instead.

Founder can **Confirm spend** for over-soft-cap jobs; hard monthly cap requires explicit settings change.

## Rough order-of-magnitude (guidance, not a quote)

Providers change prices often — keep a living price table. Directionally for architecture:

| Item | Ballpark to plan against |
|---|---|
| Reasoner turn | Cents |
| Image still | Low cents → low tens of cents |
| 5s video clip | Often **£0.50–several £** depending on model |
| TTS ≤60s | Low cents → ~£1 |
| Remotion encode | Mostly compute time on worker (Vercel/host) |

**Implication:** Recipe A (founder footage) is the cost-efficient default. Recipe B (synthetic video) must be budget-gated; prefer stills + Remotion motion over many video clips.

## Dashboard

- Project: running cost vs estimate.
- Week board: generator spend vs soft cap.
- Monthly: vs `freelanceCreative` + `tools` — success metric includes “cost per Approved Final asset.”

## Kill-rule tie-in

If three Studio weeks ship Final assets but generator spend **consistently exceeds** what a freelance editor would cost for the same volume, narrow generative video use or revisit hire — see system-design success/kill rules.
