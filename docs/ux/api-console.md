# API console (UX)

Owner flow for Public API v1 keys and webhooks. Contract: [ADR-0038](../adr/0038-public-api-v1.md). Architecture: [public-api-v1.md](../architecture/public-api-v1.md). Visual: [ui/api-console.md](../ui/api-console.md).

Editors and viewers do not create keys. Spend still uses confirm-spend / wallet when £ > 0 — the console is not a back door around the modal.

## What they see

**Settings → API.** Two lists: **Keys** and **Webhooks**. Not a Studio column. Not buried in Agent tools.

### Keys

- Name + prefix + created + last used. Revoke is explicit.
- **Create key** opens a dialog. After create, the plaintext secret is shown **once** with copy. Closing the dialog is the last chance; reload cannot recover it.
- Empty: “No API keys yet.” Primary: Create key.

### Webhooks

- URL + events (`job.ready` / `job.failed`). Signing secret shown once at create, same as keys.
- Failed delivery is a row status plus a sentence (last error). Not a tiny pill only.
- Empty: “No webhooks yet.” Primary: Add webhook.

## Cannot miss

- Plaintext secret: blocking dialog, copy control, “you will not see this again.”
- Revoke confirms. Revoked keys stay listed as revoked (or disappear — either is fine if the empty state is honest).
- Hosted localhost webhook URLs: refuse with a sentence (same family as inbound MCP). OSS/self-host may allow loopback.
- Reload: lists come from the server.

## Non-goals

- In-browser “try it” request runner in v1 (curl examples in `docs/api/v1` are enough).
- Viewer-created keys.
- Proxying MCP tools through these keys.
