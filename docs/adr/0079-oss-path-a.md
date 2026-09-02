# ADR-0079 — Path A: private source of truth, Apache-2.0 public core

**Status:** accepted  
**Date:** 2026-08-24

## Context

We want a public core that people can read and run, without turning the private operating repo into that core.

Temptations that would hurt:

- Flip the private git history public (customer names, funnel notes, keys that once lived there).
- Put a real customer GTM pack in the public tree because “it is the example.”
- Let public GitHub Actions deploy to a company’s hosted dashboard.

## Decision

**Path A.** The private repo stays the source of truth. A **new** public GitHub repository, started with **empty history**, carries an Apache-2.0 core.

### 1. Two repositories

| Repo | Role |
|---|---|
| Private (`Hepteract-Group/synawood-os`) | Source of truth. Operator docs, hosted deploy, real env, full history. |
| Public (`Hepteract-Group/synawood`, empty history) | Apache-2.0 core + sanitized seed. No production secrets. No hosted-dashboard deploy workflows. |

The public tree is generated from private `main` through a **denylist** plus authored overlays under `docs/oss/`, not by rewriting private history in place.

### 2. License

Public core: **Apache-2.0**.

### 3. Denylist (never in the public tree)

- Marketed customer packs and operator dumps
- Env files, credentials, and hosted customer data
- Operator runbooks that name real accounts, spend, or unpublished funnel tactics
- CI that deploys a hosted dashboard, applies production databases, or smokes production URLs
- Hosted billing catalog docs (list prices, launch gates)

### 4. Schema seed

The public tree ships the **same numbered migrations** as the private repo (`supabase/migrations/`). Seed data is **sanitized**.

### 5. Public CI

Public CI is **build and test only**. It must not deploy a hosted dashboard, push to the private remote, or use production database URLs.

### 6. Product-agnostic docs

Public docs may show a fictional Product. They must not ship a real customer’s strategy, brand kit, or ICP. Overlays in `docs/oss/` are the author; regex strip is a backstop.

## Consequences

- Contributors on the public repo cannot reach private operator docs or production deploy keys.
- Coding agents must not push the public remote. Snapshot jobs run from the private SoT.

## Rejected

- **Path B — make the private repo public.** History would leak. Empty-history public repo is cheaper than a perfect filter of every old commit.
- **Path C — public-only core, private customer fork.** Studio work already happens on the private SoT.
- **GPL / copyleft for the public core.** Apache-2.0 matches “use this, keep your product.”
- **Public deploy to a company’s hosted account.** A stranger’s fork must never ship there.
