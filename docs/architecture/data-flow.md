# Data flow — generate to distribute

```mermaid
sequenceDiagram
  participant Founder
  participant StudioUI
  participant API
  participant Harness
  participant Blob
  participant DB
  participant Worker
  participant Postiz
  Founder->>StudioUI: chat_upload_or_generate
  StudioUI->>API: turn_or_job
  API->>Harness: runTurn
  Harness->>Blob: store_generated_bytes
  Harness->>DB: assets_jobs_project
  Founder->>StudioUI: export
  API->>Worker: render_job
  Worker->>Blob: write_render_mp4
  Worker->>DB: render_completed
  Founder->>StudioUI: Approve
  API->>DB: final_assets
  Note over Founder,Postiz: Manual_always
  Founder->>Blob: download
  Founder->>StudioUI: paste_posted_url
  API->>DB: publish_records
  Note over Founder,Postiz: Postiz_Plan_29
  Founder->>StudioUI: Schedule
  API->>Postiz: adapter_schedule
  Postiz-->>DB: postiz_id_and_urls
```

## Status labels

**Project / candidate:** `drafting` → `rendering` → `needs_review` → `approved` | `killed`

**Publish:** `ready` → `scheduled` → `posted` | `failed` | `skipped`

See [storage-and-persistence.md](./storage-and-persistence.md) (Azure Blob + Supabase) and [distribution-and-postiz.md](./distribution-and-postiz.md). Local review: [local-first.md](./local-first.md).
