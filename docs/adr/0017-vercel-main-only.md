# ADR-0017 — Vercel: auto Production on `main`; Preview only when asked

**Status:** accepted  
**Date:** 2026-07-20  
**Supersedes (partially):** ADR-0012 preview-as-default wording

## Decision

1. **Automatic** Vercel builds: **Production from `main` only** (merge/push to `main`).
2. **Preview / branch builds:** allowed but **opt-in / manual** — never on every PR push.
3. Default review loop remains **localhost + GitHub MR checks** (`ADR-0011`).

## Why

- Auto Preview on every branch burns quota and duplicates local-first review.
- Manual Preview is still useful when the founder wants a shareable URL for a specific cut.
- Blocking all non-`main` builds via `ignoreCommand` also blocked intentional manual Previews — rejected.

## How

1. Vercel Project → **Settings → Git:** turn **off** automatic Preview Deployments (or equivalent “don’t build PRs”).
2. Production branch = `main` → auto Production deploy on merge.
3. Manual Preview when needed:
   - Vercel → Project → **Deployments → Create Deployment** → pick branch/commit, or
   - CLI: `npx vercel` (Preview) from a clean tree with linked project.
4. Do **not** use a repo `ignoreCommand` that skips every non-`main` build (that kills manual Preview).

## Rejected

- Auto Preview on every PR/branch push.
- `ignoreCommand` that permanently skips all Preview builds.
- Preview as the primary QA path.

## Consequences

- Day-to-day: localhost + MR checks; merge to `main` → Production.
- Optional: founder triggers one Preview for a branch when useful.
- After first Production URL exists, set GitHub `PROD_BASE_URL` for post-merge smoke (#35).
