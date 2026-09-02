# Inbound MCP tools (UX)

Studio as an MCP **client**. Contract: [ADR-0081](../adr/0081-inbound-mcp-tools.md). Architecture: [mcp-surface.md](../architecture/mcp-surface.md). Visual: [ui/agent-tools.md](../ui/agent-tools.md). Outbound MCP (our tools in Cursor) stays [#20](https://github.com/Hepteract-Group/marketing-os/issues/20) and is not this flow.

## What they see

**Settings → Agent tools.** One catalog. Each row has a source: **First-party** or **MCP**.

Locked first-party tools cannot be toggled off. Optional first-party can. MCP tools default **off** until enabled.

Connect is a dialog: server URL (hosted: `https://` only), name, consent copy that timeline/brand may be sent. Secrets never re-shown after save.

## Cannot miss

- Hosted SaaS: laptop `localhost` / stdio is refused with a sentence: the server must be reachable HTTPS. Not a disabled toggle with no copy.
- Discover (`tools/list`) writes catalog rows; new MCP tools stay off until the operator enables them.
- Reload: enabled set comes from the server, not a client flag.
- Chat turn: enabled MCP tools are extra verbs. Failures show in Thoughts like first-party tools.

## Non-goals

- Proxying MCP on public `/api/v1`
- Re-exporting customer MCP on outbound #20
- Account-scoped MCP secrets in v1
