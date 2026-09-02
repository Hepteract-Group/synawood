# ADR-0042 — Governance / approval chains

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision 2H · Plan index **22** · Epic [#310](https://github.com/Hepteract-Group/marketing-os/issues/310)  
**Related:** ADR-0010 (Approve ≠ Publish), ADR-0018 (trust), ADR-0024 (product roles), ADR-0006 (brand)  
**Corrects:** Epic [#310](https://github.com/Hepteract-Group/marketing-os/issues/310) children previously cited ADR-0041 (music) by mistake — **this ADR is the contract.**  
**Does not supersede:** ADR-0010 — Finals still require a completed render; governance adds stages *before* Final retention.

**Operator runbook (follow-up):** [approval-chain.md](../../core/runbooks/approval-chain.md) (#322)

## Context

Solo Approve is fine for a founder cutting weekly ≤60s Finals. Teams and regulated claims need **policy files**, a **claim scanner**, **mandatory disclaimers** on the composition, a **multi-stage Approve** chain with inbox + sign-off, **owner override** (audited), and **rejection → Studio Agent** so edits land back in chat — not a second workflow tool.

## Decision

### 1. Policy as files, mirrored to DB

Product governance lives under `products/<id>/governance/approval-policy.json` (versioned in git). A **policy loader** upserts into `governance_policies` so runtime Approve reads Postgres (fast, auditable) while git remains source of truth. Sync on load-miss and via explicit API/CLI.

### 2. Claim scanner before Final

On submit / sign-off, scan project text (overlays, slides, intent, hook/CTA) against policy `claimRules` (+ shared defaults from campaign claim-lint). Severity `block` fails closed; `warn` is recorded on the run. Extends existing `claim-lint` patterns — does not invent the private example proof points.

### 3. Disclaimer prop on compositions

When policy `disclaimer.required` is true, Talking Head / Slideshow props carry `disclaimer` text rendered as a persistent safe-area line. Missing disclaimer blocks Final (fail closed).

### 4. Multi-stage Approve pipeline

`approval_runs` + `approval_events` track stages (`editor` → `owner`, configurable). ReviewBar **Approve** opens a **Sign-off card** (not an instant Final). Completing the last stage calls existing `approveProject` (music license gate still applies). **Owner override** skips remaining stages with a required reason event — it does **not** bypass the claim scanner (ADR-0018 trust: illegal claims stay fail-closed even for owners). **Reject** returns the project to drafting and appends a Studio chat message for the Agent.

### 5. Approvals inbox

Dashboard route `/approvals` lists open runs for the operator’s product membership / role. No email/Slack in v1.

## Consequences

- Slices [#311](https://github.com/Hepteract-Group/marketing-os/issues/311)–[#320](https://github.com/Hepteract-Group/marketing-os/issues/320) implement this contract; #321–#323 are closeout (CSV, runbook, tests).
- Localization epic [#324](https://github.com/Hepteract-Group/marketing-os/issues/324) may later filter policy by locale (#333) — out of scope here.

## Rejected

- Replacing Approve with an external GRC product.
- Silent auto-Final when all stage roles match one user without a recorded event.
- Hard-coding the private example legal copy in core (belongs in product policy file).
