# ADR-0039 — Agent Marketplace (Skill + Style Packs)

**Status:** accepted  
**Date:** 2026-08-16  
**Wave:** Vision 2G · Plan index **20** · Epic [#284](https://github.com/Hepteract-Group/marketing-os/issues/284)  
**Related:** ADR-0001 (harness), ADR-0008 / ADR-0031 (skills are packs, not multi-agent runtimes), ADR-0009 (Blob + Postgres), ADR-0018 (trust / no silent spend), ADR-0024 (product membership)  
**Does not supersede:** ADR-0027 stock-media `MARKETPLACE_ADAPTERS` stubs — that port stays for Envato/Artlist/Adobe Stock placeholders. Agent packs use a **separate** module and tables.

## Context

Founders need curated **Skill Packs** (prompt/tool guidance markdown) and **Style Packs** (visual/motion recipes) without hand-copying folders into the repo. Wave 2G epic [#284](https://github.com/Hepteract-Group/marketing-os/issues/284) asks for signed artifacts, a safe install path, curator review, and revocation — free packs end-to-end. Billing and paid listing are deferred (vision roadmap).

Children [#285](https://github.com/Hepteract-Group/marketing-os/issues/285)–[#296](https://github.com/Hepteract-Group/marketing-os/issues/296) already exist and cite this ADR + plan 20.

## Decision

### 1. Packs are signed zip/tar artifacts, not live git clones

- A **pack version** is an immutable blob (Azure Blob) plus `sha256` checksum and an Ed25519 (or equivalent) **signature** over the checksum + manifest.
- Manifest (`pack.json`) declares: `id`, `slug`, `kind` (`skill` | `style`), `semver`, `mosApiVersion`, entry paths, permissions (tools the pack may hint — never silent spend).
- Publisher keys are allowlisted in product/config; unsigned packs install only in local `ci-stub` / explicit `ALLOW_UNSIGNED_PACKS=true` for founder testing.

### 2. Product-scoped installs

- Installs bind `(product_id, pack_version_id)`. Enabling a pack makes it visible to the Studio skill loader for that product only.
- Uninstall / disable does not delete blob history; revocation can force-disable all installs of a version.

**Amended 2026-08-24 ([ADR-0080](./0080-installable-studio-skills.md)):** installs are **either** Product-scoped (`product_id`) **or** Account-scoped (`user_id` — that operator, every Product they can edit). Exactly one scope per install row. V1 has no parent company row ([ADR-0068](./0068-organization-is-product-tenancy.md)). skills.sh is an install **source** that wraps `SKILL.md` into a pack; it is not a second format. The harness must load enabled installs on the live turn (do not leave Settings as a shelf).

### 3. Module boundary: `@synawood/creative/packs` (not stock `marketplace/`)

| Concern | Module |
|---|---|
| Stock media adapters (ADR-0027) | `core/creative/src/marketplace/` |
| Agent Skill/Style packs (this ADR) | `core/creative/src/packs/` |

HTTP routes live under `/api/studio/packs/…` (browse, install, installed, revoke-sync). Settings UI: `/settings/packs`.

### 4. Safety pipeline before install

Order (#286–#288):

1. Verify checksum  
2. Verify signature (or unsigned allowlist)  
3. Static safety checks (#287): no `node_modules`, no executables, manifest schema, path traversal, forbidden tool names that imply spend without confirm  
4. Extract to product-local install root under Blob or local disk (`local/…/packs/{productId}/{slug}/{version}/`)  
5. Register `marketplace_installs` (table prefix `pack_*` preferred — see schema)

### 5. Schema (names may refine in #285)

- `pack_catalog` — published listings (slug, kind, status: `draft` | `queued` | `published` | `revoked`)  
- `pack_versions` — semver, blob_key, checksum, signature, manifest jsonb  
- `pack_installs` — product_id **xor** user_id, pack_version_id, enabled, installed_at, disabled_at ([ADR-0080](./0080-installable-studio-skills.md) Account scope)  
- `pack_revocations` — pack_version_id, reason, revoked_at; clients sync via cursor (#294)  
- `pack_submissions` — curator queue (#291)

RLS on; service_role for workers; browser via `requireStudioAccess` / product membership (ADR-0024).

### 6. Loader integration (#289)

`listMarketingSkills` / specialist pack roots gain an **installed packs** search path after core + `products/{id}/marketing-skills`. Revoked or disabled installs are skipped.

**Amended 2026-08-24:** search path is core → product overlay → enabled Product installs → enabled Account installs for the acting user ([ADR-0080](./0080-installable-studio-skills.md)). `selectMarketingSkills` must use that list, not only repo folders.

### 7. Free v1 only

No Stripe, no paid listing, no revenue share. Starter packs (#296) ship as signed fixtures in-repo or Blob under `local/` for localhost.

## Consequences

- Plan 20 slices [#285](https://github.com/Hepteract-Group/marketing-os/issues/285)–[#296](https://github.com/Hepteract-Group/marketing-os/issues/296) implement this contract.  
- ADR-0031 stands: packs feed the **single** Studio Agent loop; no multi-agent runtime.  
- Stock media flag `MARKETPLACE_ADAPTERS` stays independent.

## Rejected

- Installing arbitrary npm packages or remote git URLs without signature.  
- Collapsing Agent packs into ADR-0027 stock adapters.  
- Auto-enable packs product-wide without an install row.  
- Paid marketplace / billing in this ADR (needs a later ADR).
