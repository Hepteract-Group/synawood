# Runbook — Publish an Agent Marketplace pack

**Related:** [agent-marketplace.md](../../docs/architecture/agent-marketplace.md) · ADR-0039 · Plan 20

## When

You authored a Skill or Style pack and want it installable in Studio Settings → Packs.

## Steps

1. Put `pack.json` + entry files in a directory (see fixtures under `core/creative/fixtures/packs/`).
2. `npm run mos-marketplace -- pack build <dir> --out dist/<slug>-<semver>.pack.json`
3. Sign with the allowlisted publisher private key (`pack sign` / `pack verify`).
4. Upload artifact to Blob; POST `/api/studio/packs/submissions` (editor).
5. Product **owner** POSTs approve on `/api/studio/packs/submissions/[id]/review`.
6. Editors Install from `/settings/packs`.

## Local unsigned smoke

```bash
ALLOW_UNSIGNED_PACKS=true npm run seed:starter-packs
# then Install in Settings → Packs
```

## Revocation

Insert `pack_revocations` for a `pack_version_id`. Opening Settings → Packs POSTs sync and disables matching installs (banner).
