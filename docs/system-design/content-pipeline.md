# Content pipeline

Human/runbook path under each Product context, **mirrored** by DB + Azure Blob for real media.

```
products/{name}/content/
  briefs/                 # Brief markdown (git)
  drafts/{week}/          # Draft pack copy/scripts (git)
  drafts/{week}/final/    # Pointers / notes after Approve (git)
  published/{week}/       # Posted URL notes (git)
```

**System of record for binaries and history:** Azure Blob + Supabase Postgres — see [`docs/architecture/storage-and-persistence.md`](../architecture/storage-and-persistence.md).

## Lifecycle

1. **Brief** — calendar / batch planning (git + `content_slots` row).
2. **Draft** — copy/scripts in git; raw footage → Blob + `assets`.
3. **Studio cut** — Generation/Render Jobs → Blob; project/jobs in Postgres.
4. **Approve** — Final asset retained in Blob; `final_assets` row; optional git pointer in `final/`.
5. **Publish** — paste URL into `publish_records` (always). After Approve, Schedule via Postiz adapter ([distribution-and-postiz.md](../architecture/distribution-and-postiz.md), Plan 29).
6. **Archive** — `published/{week}/` notes in git; canonical URLs live in DB.

## Ownership

- Coding agents and Studio Agent may write drafts/renders.
- Only **Approve** (human) creates Final assets.
- Only **Publish** (human confirm: paste URL or Schedule) distributes.
- Kill removes a candidate; never silently republish.
