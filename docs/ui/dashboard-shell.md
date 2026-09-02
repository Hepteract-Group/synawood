# Dashboard shell

## Primary nav (IA)

Matches the founder sketch (`docs/ui/assets/studio-sketch-2026-07-19.jpg`), plus Campaign factory + Settings:

- **Dashboard** (funnel KPIs)
- **Products** → Brand Assets Catalog (per-product brand kit browser; placeholder OK)
- **Studio** (active Studio Project workspace)
- **Campaigns** (Campaign Pack composer + pack detail — `/campaigns`)
- **Work board** (week board / Draft packs — `/content`; **Schedule** / Post now after Approve — [ADR-0065](../adr/0065-schedule-after-approve.md))
- **AI Media** (Generation Jobs + generated asset review — `/ai-media`; contract [ADR-0061](../adr/0061-ai-media-surface.md) / [0062](../adr/0062-generated-asset-review.md). UI fill-in is Plan 28 / #782 / #783.)
- **Usage** (CostEvent ledger in **pounds** week/month/project, wallet remaining, Studio tool traces — [ADR-0082](../adr/0082-hosted-billing-wallet-entitlements.md))
- **Settings** (Brand DNA, Voice profiles, Outcomes, members / invites, **Billing**, **Models** catalogue, **Agent tools** + inbound MCP, **Postiz channels**, **API** keys + webhooks, agent packs; Product switch links)
- **Insights** (Learning proposals + Final rollup explore; integrations bar → Outcomes)

Deferred: Observability. Runbooks remain linked from Dashboard. **Schedule** is a Work board control (Plan 29 / ADR-0065), not a top-level calendar.

## Rules

- The sidebar is **collapsible** (icon rail) — required so Studio's full-viewport editor (ADR-0016) owns the screen. Collapse state persists in `localStorage`.
- Under **760px** the sidebar is a top bar + labeled **Menu** (not 11 unlabeled icons). Contract: [responsive.md](./responsive.md).
- Product switcher can wait until a tenant has more than one Product; still namespace routes by product id.
- Studio is a top-level nav item — not buried under "experiments".
- Campaigns and Settings must be reachable from the shell (no URL-only surfaces).
- Do **not** show GTM phase badges (Phase 0/1/…) in operator chrome. Operators leave via **Marketing site** (`/`) and **Sign out** at the bottom of the sidebar (phone: same items inside Menu).
- New IA items may ship as placeholder pages during Plan 06; do not block the editor shell on their content. **AI Media** is no longer exempt from having real content (ADR-0061); the page still needs Plan 28 UI.
- **Tool traces live on Usage**, not in the Studio chat pane.
- Unknown routes use a branded `not-found` (Remotion “missing frame” metaphor) — not the stock Next 404.
