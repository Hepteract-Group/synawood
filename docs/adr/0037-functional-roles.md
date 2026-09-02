# ADR-0037 — Functional roles on Product membership

**Status:** accepted  
**Date:** 2026-08-22  
**Wave:** Vision 2G · Plan index **18** · Epic [#262](https://github.com/Hepteract-Group/marketing-os/issues/262)  
**Related:** ADR-0024 (Product is the tenancy unit), ADR-0042 (approval stages)  
**Does not supersede:** ADR-0024. There is still **no Organization** above Product.

**Corrects:** Epic [#262](https://github.com/Hepteract-Group/marketing-os/issues/262) children cited this ADR before the file existed. **This ADR is the contract.**

## Context

ADR-0024 membership is `owner | editor | viewer`. That is tenancy (who can open the Product). Teams also need **job function**: who signs off, who can publish, who only records outcomes. Governance (ADR-0042) already speaks `editor → owner` stages. Without a named functional role on the member row, every owner is every function.

## Decision

### 1. Membership role stays tenancy

`product_members.role` remains `owner | editor | viewer`. It still gates `requireProductRole`. Do not invent a second tenancy column.

### 2. Functional role is additive

`product_members.functional_role` is one of:

| Functional role | Default mapping from tenancy | Meaning |
|---|---|---|
| `founder` | `owner` | All functions. Default for the Product creator. |
| `editor` | `editor` | Cut, chat, Approve submit. |
| `reviewer` | (invite) | Sign-off stages in ADR-0042. |
| `publisher` | (invite) | Publish after Final. |
| `analyst` | `viewer` | Outcomes / insights only. |

A member has **one** functional role. Changing it is an audited event.

### 3. `audit_events` is universal

Every membership change, invite accept, functional-role change, and later API-key action writes `audit_events` (product_id, actor, action, payload). Service-role insert; members can read their Product’s rows.

### 4. Founder default (#271)

Migration backfill: existing `role = owner` → `functional_role = founder`; `editor` → `editor`; `viewer` → `analyst`. Null is not allowed after backfill.

### 5. Plan flags stay later

Upsell chips / plan SKUs (#270) are a follow-up. This ADR does not add billing.

## Consequences

- Schema + audit (#263) before helpers (#264) and UI (#267–#269).
- #271 is the backfill. #272 tests RLS + audit.
- Invites grow a `functional_role` (#266). Default invite editor → `editor`.

## Rejected

- An Organization / workspace above Product.
- Many functional roles per user (bitmask). One role, change it in Settings.
- Silent “founder can do everything” without a stored role (breaks audit).
