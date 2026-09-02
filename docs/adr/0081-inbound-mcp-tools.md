# ADR-0081 — Inbound MCP tools (Studio as MCP client)

**Status:** accepted  
**Date:** 2026-08-24  
**Issue:** Epic [#951](https://github.com/Hepteract-Group/marketing-os/issues/951) · land docs [#961](https://github.com/Hepteract-Group/marketing-os/issues/961)  
**Wave:** Extensibility  
**Related:** [ADR-0001](./0001-studio-agent-harness.md), [ADR-0018](./0018-studio-agent-trust-model.md), [ADR-0038](./0038-public-api-v1.md), [ADR-0079](./0079-oss-path-a.md)  
**Does not supersede:** outbound MCP ([mcp-surface.md](../architecture/mcp-surface.md), [#20](https://github.com/Hepteract-Group/marketing-os/issues/20)) — that door **exports** our Studio Tools to Cursor. This ADR is the opposite door.  
**Amends:** ADR-0001 (allowlist = first-party ∪ enabled MCP), ADR-0038 (public HTTP API stays first-party tools only).  
**Docs:** [mcp-surface.md](../architecture/mcp-surface.md), [studio-tools.md](../architecture/studio-tools.md)

## Context

Open-source and proprietary operators will run tools we cannot take as a public PR: a laptop process, a private GPU box, a licensed renderer. They still need those verbs on the Studio Agent, listed in Settings, toggleable.

Generic HTTP webhooks were proposed and deferred. MCP is the standard those operators already use with Cursor.

Constraint: the hosted agent runs on **Vercel**. It cannot call `localhost` on someone’s Mac. Self-hosted / OSS can.

## Decision

### 1. Two MCP doors (do not collapse)

| Door | Direction | Status |
|---|---|---|
| **Outbound** (#20) | Cursor → our Studio Tools | Existing plan |
| **Inbound** (this ADR) | Our Studio Agent → their MCP server | New |

Same JSON-RPC tool names/args style. Different auth, process, and trust.

### 2. Register an MCP server, then `tools/list`

v1: **Product-scoped** (the Organization). Secrets stay on the tenant, not on a personal account.

Operator adds: display name, transport, auth.

| Runtime | Allowed transport |
|---|---|
| **Hosted SaaS** | Remote MCP only (Streamable HTTP / SSE over HTTPS) with auth |
| **OSS / self-host** | Remote **or** local (`stdio` / `http://127.0.0.1`) |

After connect, call `tools/list`. Each tool becomes a catalog row `mcp:{serverId}:{toolName}` with the remote description + JSON schema. Operator enables/disables per tool (default: **off** until enabled).

Enabled MCP tools join the Vercel AI SDK `tools` map for that Product’s Studio turns, wrapped so calls are traced like first-party tools (`tool_trace`).

### 3. Locked first-party tools stay locked

MCP can **add** verbs. It cannot disable or replace:

- `inspect_preview` (ADR-0051)
- Spend confirm when estimated £ > 0 (ADR-0018)
- Approve → Final
- Core timeline reads/mutates required for a coherent cut (`get_project_summary`, `add_clip` / place, `trim_clip`, `remove_clip`)

The Settings catalog shows locked rows as on and not toggleable. Optional first-party tools (e.g. some `generate_*`) may be toggled; if they are off, “make a video” fails with a **plain Settings error**, not a silent skip of ADR-0055.

MCP tools are never locked.

### 4. Safety

- No shell, no arbitrary URL fetch tool unless it is a named MCP server the operator registered.
- Confirm-spend still wraps first-party spend. MCP tools do not get a free pass to our generators.
- Sending timeline/brand payload to an MCP server is **operator consent** (copy on the connect dialog).
- Schema from `tools/list` is the contract; we do not eval MCP-returned code.
- Timeouts, max result bytes, and per-turn MCP call caps apply.

### 5. Public API and outbound MCP

[ADR-0038](./0038-public-api-v1.md) `/api/v1` stays **first-party Studio Tools**. It does not proxy customer MCP.

Outbound #20 stays our tools only. We do not re-export a customer’s inbound MCP through our public MCP server (confused deputy).

### 6. No generic HTTP endpoints in this wave

If demand appears, a later ADR may add webhooks. Not now.

## Consequences

- New tables: MCP server registrations (product_id, transport, encrypted credentials, status) + enabled tool names.
- Settings → Agent: one catalog, two tabs or one list with source `First-party` | `MCP`.
- Hosted docs must say laptop MCP needs a **reachable HTTPS** server (or self-host). Do not imply Vercel can dial `localhost`.

## Rejected

- Pasting an arbitrary webhook as a Studio Tool in this wave.
- Importing unreviewed MCP tools as locked / always-on.
- npm/git install of in-process tool plugins (OSS contributors still use PRs for in-repo tools).
- Collapsing inbound and outbound MCP into one process.
- Account-scoped MCP secrets in v1 (Product-scoped only).

## Follow-up

Implementation tickets under the epic that cites this ADR. Skills remain [ADR-0080](./0080-installable-studio-skills.md).
