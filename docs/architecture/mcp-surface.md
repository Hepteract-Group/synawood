# MCP surface

Two doors, one Studio Tool vocabulary. Do not collapse them.

## Outbound (Studio as MCP server)

After Studio Tools are stable, expose the **same** tool schemas via an MCP server under `core/creative/mcp/`.

Coding agents (Cursor) and other MCP clients can drive Creative Studio without a second edit API. Dashboard chat and outbound MCP are two doors to one store.

Rules:

- MCP tools mirror Studio Tools 1:1 (names, args, errors).
- Auth and product scoping still apply — MCP is not an open shell.
- Do not build outbound MCP before Slice 2 tools exist in-process ([module-map.md](./module-map.md) slices in the Studio plan).
- Epic: [#20](https://github.com/Hepteract-Group/marketing-os/issues/20) (outbound MCP only). Live Postiz is Plan 29 / [#787](https://github.com/Hepteract-Group/marketing-os/issues/787), not this surface.
- Do **not** re-export a customer’s inbound MCP tools here (confused deputy).

## Inbound (Studio as MCP client)

Operators may register **their** MCP servers so extra verbs appear on the Studio Agent. Contract: [ADR-0081](../adr/0081-inbound-mcp-tools.md).

| Runtime | Transport |
|---|---|
| Hosted SaaS | Remote HTTPS MCP only (Vercel cannot dial the operator’s `localhost`) |
| OSS / self-host | Remote or local (`stdio` / `127.0.0.1`) |

Operator journey: [ux/inbound-mcp.md](../ux/inbound-mcp.md). Visual: [ui/agent-tools.md](../ui/agent-tools.md).

Register servers in **Settings → Agent tools** (Product-scoped). Secrets are encrypted at rest (`MCP_SERVER_KEY` or `PERFORMANCE_TOKEN_KEY`) and never returned to the browser. Hosted Studio only accepts public `https://` remotes; OSS may register stdio or `127.0.0.1`. Health ping uses MCP `initialize` over HTTPS/loopback and does **not** spawn stdio from the Next.js process.

`tools/list` → Settings catalog rows (`mcp:{serverId}:{toolName}`), default **off** (follow-up). Locked first-party tools cannot be replaced. Public `/api/v1` does not proxy these ([ADR-0038](../adr/0038-public-api-v1.md)). Generic HTTP webhooks are out of this wave.
