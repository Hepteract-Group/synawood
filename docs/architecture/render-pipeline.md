# Render pipeline

See [ADR-0002](../adr/0002-remotion-render-core.md).

## Preview

- First-party presets: Remotion Player in the dashboard, Studio Project → composition props.
- Authored compositions ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)): **isolated iframe** Player, same props shape (signed URLs, brand, `motionSeed`). Bundle from the allowlist compiler — no env inlined.
- Preview must not require a full encode.

## Export

1. `render_export` tool or UI button creates a **Render Job** (`queued`).
2. Worker loads project + assets, compiles authored source with the **same** isolated webpack when `compositionId === 'authored'`, runs Remotion render. Chromium may fetch signed project assets only.
3. Job → `completed` with output URIs (MP4, optional PNG).
4. UI shows candidate for Approve.

## Rules

- Never encode inside the chat request.
- Job timeouts and retries are explicit; failed jobs surface plain-English errors.
- Outputs land in Azure Blob (`renders/…`) with DB `render_jobs` rows until Approve promotes them to `final_assets` (see [storage-and-persistence.md](./storage-and-persistence.md)).
- Git `content/drafts/{week}/final/` may get a markdown pointer; bytes stay in Blob.
