# Agent Marketplace

**Contract:** [ADR-0039](../adr/0039-agent-marketplace.md) · [Plan 20](../../.cursor/plans/generated/20-agent-marketplace.plan.md) · Epic [#284](https://github.com/Hepteract-Group/marketing-os/issues/284)

Curated **Skill Packs** and **Style Packs** as signed artifacts, product-scoped installs, curator queue, and revocation.

## Not stock media

ADR-0027 `core/creative/src/marketplace/` is Envato/Artlist stubs. Agent packs live in `core/creative/src/packs/` and `/api/studio/packs/…`.

## Founder surfaces

- Browse / install — Settings → **Agent packs** (`/settings/packs`)
- Installed list — enable / disable / uninstall
- Revocation — Settings banner after sync disables matching installs

## HTTP (authenticated)

| Method | Path | Role |
|---|---|---|
| GET | `/api/studio/packs?productId=` | viewer |
| POST | `/api/studio/packs` `{ productId, packVersionId }` | editor |
| GET | `/api/studio/packs/installed?productId=` | viewer |
| PATCH/DELETE | `/api/studio/packs/installed/[installId]` | editor |
| GET/POST | `/api/studio/packs/submissions` | owner list / editor submit |
| POST | `/api/studio/packs/submissions/[id]/review` | owner |
| GET/POST | `/api/studio/packs/revocations` | viewer list / editor sync |

## Author path (publish + signing)

1. Author a pack directory with `pack.json` + entry files (`SKILL.md` or `STYLE.md`).
2. Build the JSON artifact envelope:

```bash
npm run mos-marketplace -- pack build path/to/pack-dir --out dist/my-pack.pack.json
```

3. Generate an Ed25519 keypair (Node) or use `generatePackSigningKeyPair` from `@synawood/creative/packs`, then sign:

```bash
npm run mos-marketplace -- pack sign dist/my-pack.pack.json --key private.pem
npm run mos-marketplace -- pack verify dist/my-pack.pack.json --key public.pem --sig <base64>
```

4. Upload blob bytes; create a `pack_submissions` row (API or SQL); owner approves via `/api/studio/packs/submissions/[id]/review`.
5. Product editor installs from Settings → Packs. Local unsigned installs require `ALLOW_UNSIGNED_PACKS=true`.

## Local starter packs (#296)

Fixtures live under `core/creative/fixtures/packs/`. Seed into local Supabase + Blob:

```bash
# root .env pointed at local Supabase; Azure local prefix on
ALLOW_UNSIGNED_PACKS=true npm run seed:starter-packs
```

Then open `/settings/packs` and Install.
