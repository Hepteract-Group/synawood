# Open-source briefing

**Chosen path: A** — private source of truth + Apache-2.0 public core with empty history.  
**Locked in:** [ADR-0079](../adr/0079-oss-path-a.md) (2026-08-24).

## Founder calls (2026-08-23)

Recorded so later tickets do not re-litigate:

1. **the private example is an example Product**, not the name of the platform. Public materials must not treat the private example as Synawood.
2. **Funnel / CRO scrub.** Public docs do not reprint internal funnel tactics, spend, or account names.
3. **In-place vision edits.** CONTEXT, old ADRs, and vision docs: the private example may appear as a private example Product, never as the platform. Landed in #898.
4. **No public deploy workflows.** Public CI never deploys to Vercel team `hosted-vercel-team`.
5. **Hosted billing catalog stays private.** ADR-0082 / 0083 and `docs/*/billing.md` are on the public-tree denylist. Do not copy list prices or Stripe launch gates into the Apache repo.

## Paths (for the record)

| Path | What it is | Status |
|---|---|---|
| **A** | Private SoT. New public repo `Hepteract-Group/synawood`, empty history, Apache-2.0, denylist, sanitized migrations. | **Chosen** |
| B | Make `marketing-os` public in place | Rejected (history + the private example) |
| C | Public-only core, private the private example fork | Rejected (we already work from this private SoT) |

## Contract (do not silently change)

- License: Apache-2.0 on the public repo.
- Public git history starts empty.
- the private example GTM does not live in this git tree (`products/demo/` is gone; archive is gitignored `docs/local/demo-gtm/` only).
- Same numbered `supabase/migrations/` as private `main`; seed is sanitized.
- Public CI: build and test only. Never `hosted-vercel-team`.
