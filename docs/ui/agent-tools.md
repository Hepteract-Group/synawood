# Agent tools catalog (UI)

Visual spec. Behaviour: [ux/inbound-mcp.md](../ux/inbound-mcp.md) + first-party allowlist (ADR-0001 as amended). Tokens: [tokens.md](./tokens.md). Settings shell: [dashboard-shell.md](./dashboard-shell.md).

## Route

`/settings/agent-tools` (Settings → **Agent tools**). Not a Studio column next to the player.

## Page

1. Title: **Agent tools**
2. Intro one line: which verbs the Studio Agent may call.
3. Primary: **Connect MCP server**
4. List grouped or badged: **First-party** then **MCP**

### Row

| Element | Spec |
|---|---|
| Name | Tool name |
| Source | chip **First-party** or **MCP** |
| Lock | Locked rows: no toggle; caption “Always on” |
| Toggle | Optional first-party and MCP; MCP defaults off |

### Connect dialog

Max width ~480px. Fields: display name, URL. Hosted: URL input pattern `https://`. Consent checkbox + sentence before Connect. Error for `localhost` / stdio on hosted: full sentence under the field, not a toast only.
