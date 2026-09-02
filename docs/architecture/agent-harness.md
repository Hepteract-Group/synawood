# Studio Agent harness

## Short answer

The Studio Agent is **not** “just APIs,” and it is **not** a heavyweight multi-agent framework.

It is a **thin tool-calling loop**:

1. Build messages (system context + chat history + compressed project summary).
2. Call a model via **Vercel AI SDK** with a registered set of **Studio Tools**.
3. Execute tool calls as **pure functions** against the Studio Project store.
4. Feed tool results back to the model until it stops calling tools or hits a limit.
5. Return assistant text + updated project snapshot to the UI.

Generators (image, video clip, TTS, transcription) are **tools or tool-subcalls**, not a separate agent. They create assets; the agent then places them on the timeline **or** writes **composition source** (`write_composition`). Remotion encode is still not inside the chat request — `render_export` enqueues a Render Job. The LLM never `eval`s TSX as Node.

See [ADR-0001](../adr/0001-studio-agent-harness.md). Marketing skill packs and a critic rubric join this same loop. They do not add Strategist / CD / Art runtime agents.

## What “agent” means here

| Term | Meaning |
|---|---|
| Studio Agent | In-product LLM loop that edits a Studio Project |
| Coding agent | Cursor (or similar) working on this repo |
| Marketing skill | Modular GTM craft package loaded into Studio Agent |
| MCP client (outbound) | Optional external driver calling **our** Studio Tools |
| MCP server (inbound) | Optional operator-registered MCP whose tools join the in-app allowlist |

Do not conflate them.

## Harness shape (functional)

```ts
type RunTurnInput = {
  productId: string
  projectId: string
  messages: ChatMessage[]
  userMessage: string
}

type RunTurnResult = {
  messages: ChatMessage[]
  project: StudioProject
  toolTrace: ToolTraceEntry[]
}

const runTurn = async (input: RunTurnInput): Promise<RunTurnResult> => {
  // 1. load project + brand + product-marketing excerpt
  // 2. streamText({ model, system, messages, tools })
  // 3. tools mutate project via store
  // 4. persist project + return
}
```

No class-based `Agent`. No graph runtime. Limits: max steps, max tokens, allowlist of tools per turn.

## Why Vercel AI SDK (not LangChain / LangGraph / CrewAI)

| Option | Verdict |
|---|---|
| **Vercel AI SDK tool loop** | Chosen — fits Next.js, provider-agnostic, functional, small surface |
| Raw provider APIs only | Possible but we would reimplement streaming, tool schema, multi-step |
| LangChain / LangGraph | Rejected — heavy abstractions, class-oriented patterns |
| CrewAI / multi-agent | Rejected — one operator, one project |
| Cursor as the editor | Complementary later via MCP; not the in-dashboard runtime |

## System prompt ingredients

- Product voice from the Organization’s marketing excerpt
- Selected marketing skills for this brief / turn
- Active Model Profile (which image / video / speech models tools will call)
- Channel + length constraints from the Brief
- Brand kit facts (colors, logo, forbidden claims)
- Current project summary — not full binary assets
- Cost remaining vs caps
- Tool discipline: mutate project → preview; `render_export` when asked or when the cut is complete

## Failure modes

- Model invents clips that do not exist → tools must validate asset IDs
- Model narrates success without tools → assistant text is derived from the tool trace
- Endless tool loops → hard max steps + UI cancel
- Render on every chat turn → forbid; export is explicit
- Off-brand copy → Approve is human; the agent drafts only

## Relationship to APIs

**APIs are the body; the harness is the nervous system.** Without the harness you have disconnected API calls and no reliable edit loop. Without generators you can only edit uploads. Without Remotion assembly you only have raw model dumps — not production-ready Final assets.
