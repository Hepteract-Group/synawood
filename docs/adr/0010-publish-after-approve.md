# Approve ≠ Publish

Approve writes Final assets to Blob/DB. **Publish** is a separate human step: paste a posted URL (always available) or **Schedule** via the Postiz adapter in `core/channels` ([ADR-0063](./0063-postiz-in-scope.md) / Plan 29). The dashboard never auto-posts on Approve.

**Why:** Manual-first operating model; creative history must exist before a slot goes out; Postiz must not become the database of creatives.

**Amended by [ADR-0063](./0063-postiz-in-scope.md):** live Postiz is in scope (epic [#787](https://github.com/Hepteract-Group/marketing-os/issues/787)), not parked. Adapter and Schedule UX: [ADR-0064](./0064-postiz-public-api-adapter.md), [ADR-0065](./0065-schedule-after-approve.md).

**Rejected:** Auto-post on Approve. Treating Postiz as the database of creatives. Wiring Postiz before Studio could Approve and retain media (that gate already shipped in Plan 05).
