# ADR-0079 — Empty-history Apache core

**Status:** accepted
**Date:** 2026-08-24

## Context

People should be able to read and run Synawood without inheriting operating history: customer names, funnel notes, keys that once lived in git.

Temptations that would hurt:

- Publish a long private history and hope nobody greps it.
- Ship a real customer GTM pack because “it is the example.”
- Let public GitHub Actions deploy someone else’s hosted dashboard.

## Decision

This repository is an **Apache-2.0 core** started from **empty git history**. It is a published tree, not a dump of operating logs.

### 1. What ships

Apache-licensed dashboard, Creative Studio, runbooks, automations, and sanitized migrations. Fixture kit: `products/demo/`. No production secrets. No workflows that deploy a company’s hosted dashboard.

### 2. What does not ship

- Marketed customer packs and operator dumps
- Env files with values, credentials, hosted customer data
- CI that deploys a hosted dashboard or smokes production URLs
- Hosted billing catalog docs (list prices, launch gates)

### 3. Schema

The public tree ships the same numbered migrations (`supabase/migrations/`). Seed data is sanitized.

### 4. Public CI

Build and test only. It must not deploy a hosted dashboard or use production database URLs.

## Consequences

- A stranger’s fork must never ship to someone else’s Vercel team.
- Contributors work on this tree through pull requests. Do not commit secrets.

## Rejected

- **Publish the full operating history.** Empty history is cheaper than a perfect filter of every old commit.
- **GPL / copyleft.** Apache-2.0 matches “use this, keep your product.”
- **Public deploy into a company’s hosted account.**
