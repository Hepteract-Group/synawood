# Runbook: Approval chain

**Purpose:** Run multi-stage Approve (claim scan, disclaimer, sign-off, optional owner override) and keep an audit trail.
**Cadence:** Every time a Studio cut is ready for Final.
**Owner:** Product owner (marketing operator); editors may complete editor-stage sign-off.
**Time budget:** 2–5 minutes per cut after Export.
**Automation status:** partially automated — Sign-off card + `/approvals` inbox; CSV export is on demand.

Contracts: [ADR-0042](../../docs/adr/0042-governance-approval-chains.md), plan 22 / epic [#310](https://github.com/Hepteract-Group/marketing-os/issues/310).

## Inputs

- Local review: `npm run dev:review` → `http://127.0.0.1:3011` (or `localhost:3000`)
- Product policy file: `products/<id>/governance/approval-policy.json` (the private example ships one)
- A rendered candidate (Approve still requires a completed render — ADR-0010)
- Music beds on the cut must be license-cleared (ADR-0041)

## Steps

### A — Start the chain from Studio

1. Open the project in Studio. Export until ReviewBar shows a candidate.
2. Click **Approve**. Done = Sign-off card opens (not an instant Final).
3. Read the claim scan. **Block** findings must be fixed in the cut or chat — owner override does **not** skip the scanner.
4. Confirm the disclaimer line is present when policy requires it.
5. Click **Sign off** for the current stage. Done = stage advances, or Final is retained if this was the last stage.

### B — Inbox

1. Open **Approvals** in the shell (`/approvals`).
2. Open the waiting project. Done = Studio loads that cut on the current stage.

### C — Owner override

1. Only product **owners**. Enter a reason (≥8 characters).
2. Override completes remaining stages and retains Final **only if** the claim scan is clear and disclaimer rules pass.
3. The run status becomes `overridden`; the reason is on the event row.

### D — Reject

1. Enter a short reason. Done = project returns to `drafting` and a chat message asks the Studio Agent to revise.

### E — Audit CSV (enterprise)

1. On `/approvals`, click **Download audit CSV** (owners).
2. Done = a CSV of runs + events (`sign_off`, `override`, `reject`, `claim_scan`, …) including a `detail` JSON column (claim-scan payload when present). Export is capped (200 runs / 2000 events). Store it with the week’s compliance pack if needed.

## Outputs

- `approval_runs` + `approval_events` rows
- Final asset when the last stage (or a valid override) completes
- Optional CSV audit file

## Escalation

| Symptom | What to do |
|---|---|
| Approve blocked by claim scanner | Edit the overlay/slide/intent text; do not invent the private example proof points. |
| Override still blocked | Scanner is working as designed. Fix the claim, then override if you still need to skip remaining *stages*. |
| Missing disclaimer | Sync policy (`products/<id>/governance/approval-policy.json`) or add disclaimer text. |
| 403 on CSV | Sign in as a product owner. |
| Policy file vs DB drift | Use Sign-off **Sync policy** if present, or re-open Studio so the loader upserts. |

## Change log

- 2026-08-17 — Initial approval-chain runbook (#322).
- 2026-08-17 — Audit CSV includes event `detail` and is row-capped (#510).
