# ADR-0080 — Installable Studio skills (account vs Product, skills.sh)

**Status:** accepted  
**Date:** 2026-08-24  
**Issue:** Epic [#950](https://github.com/Hepteract-Group/marketing-os/issues/950) · land docs [#961](https://github.com/Hepteract-Group/marketing-os/issues/961)  
**Wave:** Extensibility · follows [ADR-0039](./0039-agent-marketplace.md)  
**Related:** [ADR-0008](./0008-marketing-skills-for-studio.md), [ADR-0031](./0031-multi-agent-as-skills.md), [ADR-0068](./0068-organization-is-product-tenancy.md)  
**Does not supersede:** ADR-0008 (repo skills stay first-party), ADR-0031 (one reasoner), ADR-0039 (signed packs, no silent spend).  
**Amends:** ADR-0039 §2 (installs were Product-only).  
**Docs:** [marketing-skills.md](../architecture/marketing-skills.md)

## Context

Operators want Cursor-style skills for Creative Studio: markdown that changes how slides and videos come out (hooks, talking-head polish, infographic density), without waiting on a first-party PR.

ADR-0039 already ships Skill + Style **packs** and Settings → Packs. Gaps:

1. Installs are **Product-only**. There is no “this person, every Organization they can edit.”
2. `selectMarketingSkills` does not load installed packs into the live turn (loader exists, harness does not use it).
3. There is no **skills.sh** install path. The Agent Skills format (`SKILL.md` + YAML `name` / `description`) is already close to our packs.

V1 tenancy ([ADR-0068](./0068-organization-is-product-tenancy.md)): Organization **is** the Product row. “All products” does **not** mean a parent company. It means **account scope** (this user).

## Decision

### 1. Skills stay markdown craft, not new Studio Tools

A Studio skill is a `SKILL.md` (Agent Skills frontmatter: `name`, `description`, plus our optional fields). It changes prompt/tool *policy*. It does not register a new verb. New hands are PRs or inbound MCP ([ADR-0081](./0081-inbound-mcp-tools.md)).

Hosted SaaS: **instructions only**. If a package ships `scripts/` or binaries, refuse the install (or strip and warn). Executables are tools.

### 2. Two install scopes (v1)

| Scope | Binds to | Applies when |
|---|---|---|
| **Product** | `product_id` (the Organization) | Any operator in that Organization |
| **Account** | `user_id` (Supabase Auth) | That person, on every Product they can edit |

Not in v1: per Studio Project; parent billing org; “all members of a company with many Product rows.”

UI: on install, operator picks **This organization** vs **My account**. Default: This organization.

### 3. Loader order for each turn

`selectMarketingSkills` / `listMarketingSkills` resolve, later wins on id clash:

1. First-party `core/marketing-skills/`
2. Repo overlay `products/{id}/marketing-skills/` (private example Products only)
3. **Enabled Product-scoped** installed packs (ADR-0039)
4. **Enabled Account-scoped** installed packs for the acting user

Revoked / disabled installs are skipped. Trace skill ids on the turn (existing ADR-0008 tracing).

### 4. skills.sh is an install source, not a second format

Settings → Packs (or Skills): paste `owner/repo`, a skill slug, or a `SKILL.md` URL.

Server-side fetch using Agent Skills discovery (same layout as `npx skills add`: repo `SKILL.md` / `skills/**/SKILL.md`). Wrap as an ADR-0039 pack version (checksum stored). Operator then sets Product vs Account scope.

We may publish our own video/marketing skills to [skills.sh](https://skills.sh) so they install in Cursor **and** Studio. Publishing is docs + catalog entries, not a second runtime.

Do **not** shell out to `npx` on Vercel as the source of truth. Fetch + parse on the server. Size limits: follow skills.sh defaults (download ~10 MiB, extract ~25 MiB).

### 5. Settings is the catalog

Operators can list installed skills, read the markdown, enable/disable, uninstall. Same page as first-party skills (read-only, always on unless we later add a disable for a first-party id — default: first-party stay on).

## Consequences

- Schema: `pack_installs` (or equivalent) gains nullable `user_id`; exactly one of `product_id` | `user_id`. Unique `(user_id, pack_version_id)` and `(product_id, pack_version_id)`.
- Harness must call the installed-pack loader every Studio turn (the #289 gap).
- Safety pipeline (ADR-0039) still runs. skills.sh fetches are treated as unsigned until wrapped; they still fail closed on executables / `node_modules` / spend hints without `requiresConfirmSpend`.

## Rejected

- Per-Studio-Project skill installs in v1.
- A parent `organizations` table to mean “all marketed lines.”
- Running skill `scripts/` on hosted SaaS.
- Treating skills.sh packages as inbound MCP tools.
- Auto-enable a Product pack for every Product the user belongs to.

## Follow-up

Implementation tickets under the epic that cites this ADR. Inbound MCP tools are [ADR-0081](./0081-inbound-mcp-tools.md), not this file.
