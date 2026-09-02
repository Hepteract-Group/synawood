# ADR-0063 — Postiz adapter is in scope (no longer deferred)

**Status:** accepted  
**Date:** 2026-08-22  
**Plan:** **29** · Epic [#787](https://github.com/Hepteract-Group/marketing-os/issues/787) · Contract task [#794](https://github.com/Hepteract-Group/marketing-os/issues/794)  
**Related:** ADR-0010 (Approve ≠ Publish), ADR-0064 (Public API adapter), ADR-0065 (Schedule UX)  
**Amends:** [ADR-0010](./0010-publish-after-approve.md) — Postiz is **planned now**, not parked as “Phase 2 someday.” Approve still never posts.  
**Does not supersede:** ADR-0010’s split (Approve vs Publish). Manual paste-URL. MCP ([#20](https://github.com/Hepteract-Group/marketing-os/issues/20)).

**Operator docs:** [distribution-and-postiz.md](../architecture/distribution-and-postiz.md) · Plan [29](../../.cursor/plans/generated/29-postiz-adapter.plan.md)

## Context

Plan 05 shipped Approve, `publish_records`, and a **manual** publish adapter. `createPostizPublishAdapter` still throws `not_implemented`. Generated plans and [#20](https://github.com/Hepteract-Group/marketing-os/issues/20) treated live Postiz as deferred alongside MCP.

That mix is wrong twice. Video already left #20 for [#512](https://github.com/Hepteract-Group/marketing-os/issues/512). Postiz is distribution, not Studio MCP. Leaving it unlabeled as “Phase 2” meant nobody could implement it without inventing the contract in the PR.

The port, table, and unique `postiz_id` index already exist. Manual cadence is proven enough to wire the scheduler.

## Decision

### 1. Postiz is Plan 29, epic #787

Implement the live adapter against the **Postiz Public API** (`core/channels`). Same Cloud and self-hosted surface; we prefer self-host on Fly ([stack.md](../architecture/stack.md)).

### 2. Approve still does not publish

Founder **Approves** a Final, then **Schedules** (or posts now, or pastes a URL). No auto-post on Approve. No Studio Agent call to Postiz.

### 3. MCP stays on #20

[#20](https://github.com/Hepteract-Group/marketing-os/issues/20) is **MCP only** (same Studio Tools over MCP). It stays P2 / deferred. Do not implement MCP in Plan 29.

### 4. Manual adapter stays

`manualPublishAdapter` + paste posted URL remain for blog, email, ads, and any organic fallback. Postiz is an adapter behind the port, not a second source of truth.

## Rejected

- Keeping Postiz mixed into #20 with MCP.
- Auto-post when the founder hits Approve.
- Building our own multi-network scheduler.
- Treating Postiz as the creative database (Studio Project + `final_assets` + Blob stay SoT for media).
- Waiting on MCP before the first scheduled organic post.
