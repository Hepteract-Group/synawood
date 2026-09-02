# Thin tool-calling harness (Vercel AI SDK), not an agent framework

Creative Studio needs a Studio Agent that can iterate on a Studio Project. We use a **thin tool-calling loop** via the **Vercel AI SDK** (`ai` package: `streamText` / `generateText` + tools), not LangChain, LangGraph, CrewAI, AutoGen, or similar orchestration frameworks.

**Why:** Synawood is functional TypeScript on Next.js/Vercel. A framework that owns state machines, memory graphs, and class hierarchies fights our conventions and adds lock-in we do not need for a marketing-team studio (one Product, many members, one project at a time — [ADR-0070](./0070-studio-operators-are-a-marketing-team.md)). The AI SDK gives provider-agnostic model access and first-class tool calling; **we own** the loop, prompts, and Studio Tools.

**Rejected:** One-shot “script → API → file” pipelines (too rigid for editor-hire replacement). Multi-agent crews (overkill for one Studio Project). Live multiplayer as a reason to pick an orchestration framework.

**Consequence:** Studio Tools are plain functions over the project store. **Outbound** MCP later wraps the same functions for Cursor ([mcp-surface.md](../architecture/mcp-surface.md), #20). **Inbound** MCP ([ADR-0081](./0081-inbound-mcp-tools.md)) lets a Product register extra tools; it does not add a second agent stack.

**Amended 2026-08-31 (#1329):** Execute turns classify an **operator job** (audio.voice, picture.patch, …). Leftover inspect-fail is **debt**, not step 0. Force-tool queues are job-scoped — placing voiceover must not force `write_composition`. Inspect remains required before claiming done / Approve ([ADR-0051](./0051-agent-watches-the-player.md)).

**Amended 2026-08-30 (#1325 / #1328):** Chat footer **Mode** is Plan / Ask / Inspect / Execute. The picker is binding — we do not regex- or classifier-guess mode from the message. Plan writes a detailed plan (no generate; if they asked to make it, tell them to switch to Execute). Inspect watches the player then recommends or plans. Execute may plan, inspect, and make the ad (ADR-0055 still applies); the Studio Agent distinguishes “plan only” vs “make it” from the message while the tool map stays Execute.

**Amended 2026-08-24 ([ADR-0080](./0080-installable-studio-skills.md), [ADR-0081](./0081-inbound-mcp-tools.md)):**

- The in-turn tool map is **locked first-party ∪ enabled optional first-party ∪ enabled inbound MCP tools**. Locked tools (`inspect_preview`, spend confirm when £>0, Approve→Final, core timeline read/mutate) cannot be toggled off in Settings.
- Operators see that map in Settings (catalog). Optional first-party and MCP tools default off until enabled (MCP) or on until disabled (optional first-party — product default: on).
- Marketing skills (markdown) are not tools. Installable skills: [ADR-0080](./0080-installable-studio-skills.md).
- Public `/api/v1` does not grow extra MCP verbs ([ADR-0038](./0038-public-api-v1.md)).
