# Review gates

Three explicit actions — never bury in chat-only confirmation.

| Action | Meaning |
|---|---|
| **Approve** | Candidate becomes Final asset: immutable Blob copy under `finals/…` + `final_assets` row |
| **Back to draft** | Return project to `drafting` so you can re-cut / re-export (API action: regenerate) |
| **Discard** | Discard candidate for this slot; mark draft killed; do not publish (API action: kill) |

## Rules

- Approve requires a completed Render Job (no approving preview-only).
- **Approve ≠ Publish.** After Approve, Schedule / Post now / paste URL on the Work board ([schedule-and-publish.md](./schedule-and-publish.md)). Approve never posts.
- Discard is allowed at any time; no shame UX — quality gate is the team’s voice.
- **Back to draft** (API: regenerate) returns the project to `drafting` so the operator can re-cut and Export again. Prior Finals stay retained.
- Project lifecycle status lives in the workspace header — not beside Export actions.
- UI labels use Discard / Back to draft; API action names remain `kill` / `regenerate`.
- **Thumbnail** (optional): on this surface, not in the Studio Agent loop ([approval-thumbnail.md](./approval-thumbnail.md), ADR-0077). Generate uses modal + banner. Approve without a thumbnail is allowed; Schedule may nudge for YouTube.
- **Logo:** Approve stays blocked until Path C has a logo ([ADR-0083](../adr/0083-trial-path-to-first-approve.md)). Colour-only is not branded.
- **Trial:** Approve is allowed with a trial watermark. Work board should label **Trial export**. Paid plan: next export has no mark ([ADR-0082](../adr/0082-hosted-billing-wallet-entitlements.md)).
