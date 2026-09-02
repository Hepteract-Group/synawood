# ADR-0035 — Performance ingestion (outcomes)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision 2F · Plan index **16** · Epic [#237](https://github.com/Hepteract-Group/marketing-os/issues/237)  
**Related:** ADR-0010 (Approve ≠ Publish), ADR-0034 (creative structure snapshot)  
**Corrects:** Epic [#237](https://github.com/Hepteract-Group/marketing-os/issues/237) children cited this ADR before the file existed. **This ADR is the contract.**

**Operator runbook:** [analytics-connect.md](../../core/runbooks/analytics-connect.md)

## Context

Learning later needs **outcomes attributed to Finals**, not a vanity dashboard. Organic and commerce APIs are flaky, secret-bearing, and easy to over-scope. Founders already paste posted URLs on the work board.

## Decision

### 1. Manual outcomes are the live v1 path

Operators record views / clicks / signups / revenue against a publish record, Final, or posted URL. This is the path that must work without third-party OAuth.

### 2. Tokens are encrypted at rest

Integration secrets (paste-a-token in v1; OAuth later) store **ciphertext + nonce**, never plaintext. Encryption key is `PERFORMANCE_TOKEN_KEY` (32-byte hex). Missing key **fails closed** on write. Logs never print tokens.

### 3. Source adapters are stubs until OAuth (#246)

Organic (TikTok / Meta / YouTube / LinkedIn) and commerce (Shopify / Stripe) expose a `pull()` interface. v1 returns empty with `reason: not_connected` or `stub_provider`. No live network spend in this landing.

### 4. Attribution matcher

Match order: explicit `publishRecordId` / `finalAssetId` → exact `publish_records.external_url` → **unattributed_activity**. Never invent a Final id.

### 5. `creative_performance` materialized view

Aggregates outcomes onto Finals (and their structure snapshot) for later Learning. Refresh is explicit (`refresh_creative_performance()`), not a trigger on every insert.

## Consequences

- Plan 16 slices [#238](https://github.com/Hepteract-Group/marketing-os/issues/238)–[#244](https://github.com/Hepteract-Group/marketing-os/issues/244) land schema, crypto, stubs, manual form, matcher, and the view.
- Closeout slices [#247](https://github.com/Hepteract-Group/marketing-os/issues/247)–[#249](https://github.com/Hepteract-Group/marketing-os/issues/249) add the integrations bar, runbook, and tests.
- **2026-08-22:** [#245](https://github.com/Hepteract-Group/marketing-os/issues/245) stub pull worker + cron, and [#246](https://github.com/Hepteract-Group/marketing-os/issues/246) Settings OAuth Connect (fails closed without app ids). Live provider pulls still wait for a spend/scopes ADR. Adapters remain `stub_provider` / `not_connected`.

## Rejected

- Calling TikTok/Meta/Shopify in v1 without an ADR for spend + scopes.
- Storing OAuth refresh tokens in plaintext env or `project_json`.
- Blocking Approve when no outcomes exist.
