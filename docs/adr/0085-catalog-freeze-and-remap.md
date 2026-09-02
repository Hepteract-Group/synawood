# ADR-0085 — Catalog freeze and remap

**Status:** accepted  
**Date:** 2026-08-25  
**Issue:** Epic [#1003](https://github.com/Hepteract-Group/marketing-os/issues/1003) · land docs [#1004](https://github.com/Hepteract-Group/marketing-os/issues/1004) · freeze/remap [#1005](https://github.com/Hepteract-Group/marketing-os/issues/1005)  
**Amends:** [ADR-0007](./0007-model-profiles.md) (allowlisted ids must be **Live**, **Remapped**, or **Frozen** — Frozen cannot spend).  
**Related:** [ADR-0084](./0084-gateway-model-families.md) (families), [ADR-0018](./0018-studio-agent-trust-model.md) (loud failures), [ADR-0082](./0082-hosted-billing-wallet-entitlements.md) (no debit on a blocked generate)  
**Docs:** [architecture/gateway-catalog.md](../architecture/gateway-catalog.md), [ux/model-catalogue.md](../ux/model-catalogue.md), [ui/model-catalogue.md](../ui/model-catalogue.md)

## Context

Gateway ids churn. We already remap one video id: `google/veo-3.1-fast-generate-preview` → `google/veo-3.1-fast-generate-001` (`LEGACY_VIDEO_MODEL_ALIASES`). Image → Grok pictures still sends **`xai/grok-imagine-image`**. Live Gateway id (2026-08-25) is **`spacexai/grok-imagine-image`**. That picker row is a dead id: generate can 404 **after** the founder intends to spend.

A missing successor is different from a renamed id. Both must be visible. Neither may debit the wallet (ADR-0082) or open confirm-spend for a call we know will fail.

## Decision

### 1. Three states per allowlisted id

| State | Meaning | Spend |
|---|---|---|
| **Live** | Exact id present on `GET https://ai-gateway.vercel.sh/v1/models` | Allowed (confirmSpend still applies when £>0) |
| **Remapped** | Old id has a successor in our alias table; we send the canonical id | Allowed on the **canonical** id |
| **Frozen** | Not on Gateway, no successor | **Blocked** before Gateway. No confirmSpend. No enqueue. No wallet debit |

Source of truth for presence: Gateway `/v1/models` (no auth). Our allowlist stays curated (ADR-0084). Sync does not auto-add new catalog rows.

### 2. Remap vs freeze

- **Remap** = same product, new string. Rewrite. Existing `model_profile_id` / `video_model_id` / `reasoner_model_id` rows keep working.
- **Freeze** = no successor. Picker shows the row **disabled** with copy: this model is gone from Vercel — no spend. Chat bubble (not a pill): same. Catalogue: Frozen badge.

First remap: `xai/grok-imagine-image` → `spacexai/grok-imagine-image`. Price table and `GATEWAY_IMAGE_MODELS` use the canonical id. `xai/` prefix must not count as “live.”

### 3. Sync loop

CI and/or a small scheduled job (daily is enough; local `npm` script for founder):

1. Fetch `/v1/models`.
2. For each allowlisted canonical id: present → Live; else if alias target present → Remapped; else Frozen.
3. Persist status (committed snapshot in-repo **and/or** a small table). Picker and generate tools read that status, not a client flag.

A Frozen id that returns to Gateway becomes Live on the next sync (no silent spend in between).

### 4. Generate path

`generate_image` / `generate_video_clip` / reasoner turn:

1. Canonicalize (alias table).
2. If Frozen → tool error, founder-visible, credits untouched.
3. Else preflight (family adapter, ADR-0084) → estimate → confirmSpend → Gateway.

## Consequences

- Image allowlist grows an alias table matching video’s `LEGACY_VIDEO_MODEL_ALIASES`.
- Catalogue and pickers share one status helper.
- Tests: dead id does not call Gateway; remapped id sends canonical string.

## Rejected

- Auto-adding every new Gateway id when sync runs.
- Leaving `xai/` as a “looks live” prefix match.
- Freezing login or the whole Studio because one model died (generation for **that** id only).
