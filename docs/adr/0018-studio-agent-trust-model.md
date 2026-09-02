# ADR-0018 — Studio Agent trust model: trace-grounded responses + deterministic gates + QC loop

**Status:** accepted
**Date:** 2026-07-21
**Relates to:** ADR-0001 (thin harness), ADR-0003 (project JSON is truth), ADR-0005 (generators), ADR-0007 (model profiles)

**Amended by [ADR-0051](./0051-agent-watches-the-player.md):** For “make a video,” the VLM pass is **required**, not optional. File QC is not enough. The agent must look at player frames (`inspect_preview`) and cannot complete on a failing rubric.

## Context

Studio Agent turns have shipped three classes of fabrication in production traces:

1. **Fabricated success** — a tool ran as a no-op (e.g. `pack_clips` on the wrong `trackId`) and returned `ok`; the agent narrated "closed the gap."
2. **Narrate-without-act** — reasoners (notably MiniMax) replied "please wait while I process…" and issued **zero** tool calls.

**Amended by [ADR-0055](./0055-reasoner-must-generate.md):** on make-an-ad, the harness requires a tool call and fails the bubble if `generate_video_clip` never ran. Every reasoner. No silent model swap.
3. **Fabricated result + substitution** — `generate_image` returned `ok:false` for Gemini multimodal models; the agent then reused an unrelated prior asset and claimed the requested image was placed.

Prompt patches ("never say please wait", "don't substitute assets") did not durably fix any of them. The 2026 literature is explicit that they cannot: an LLM is a string generator and, by default, nothing stops it from asserting a tool call it never made or a result it never received (see "Tool Receipts" arXiv 2603.10060; "Reason Less, Verify More" arXiv 2607.07405).

Independently, three shipped agentic editors (Cutible, FableCut, Bom Agent) converged on the same architecture we already have — JSON timeline as source of truth, pure-function verbs, revision-counter concurrency, live human+agent co-editing. Our harness is **not** the problem. The gap is the verification half of the loop.

## Decision

Adopt a **trust model** for the Studio Agent with three enforced properties. They are additive to ADR-0001; the thin Vercel AI SDK loop stays.

### 1. Trace-grounded responses (the assistant summary is derived, not authored)

The user-visible "what I did" message for a turn is **built from `ctx.toolTrace` + the project revision diff**, not from `result.text`. The reasoner may still write prose, but any assertion in that prose about *state changes* must be reconciled against the trace before it reaches the UI; unreconciled claims are dropped or flagged.

Consequence: a model literally cannot report success for a tool call that did not succeed. `generate_image → ok:false` surfaces the real error; `pack_clips` no-op cannot appear as "closed the gap".

### 2. Deterministic pre/post gates on every mutating verb

Every verb in `core/creative/project/operations.ts` (and its `studio-tools.ts` wrapper) must:

- **Pre-gate** — validate inputs against current `StudioProject` state (asset exists, track exists, placement in range, etc.). Reject with a structured error the agent can re-plan against.
- **Post-gate** — if the mutation produced **no change** to the project, return a structured error, never `ok`. No-op ≠ success.

Gates are pure functions, no LLM calls, no writes. `resolveTrackId` + the recent `packClips` throw are the pattern; generalise it.

### 3. Closed perception / QC loop for generated media

After `generate_image`, `generate_video_clip`, or `render_export`, a **QC step** runs before the outcome is reported:

- Asset exists in blob, non-empty, dimensions/duration within expected bounds.
- Optional (behind flag) VLM caption check that the artefact matches the requesting prompt.

Failures feed back into the same turn as structured errors so the agent self-corrects; they do not silently degrade into "success."

## Supporting infrastructure

- **Model eval harness.** Fixture prompts ("close the gap", "generate developer image + place at end", "cover proof with close-ups") assert on the resulting `StudioProject` JSON and `toolTrace` order. Library-first: `find_moments` before `generate_video_clip` when shots exist (#526). Runs per reasoner in the registry (ADR-0007). Turns "MiniMax lies" from anecdote into a measured score, so reasoner selection is data-driven.
- **Trace-visible UI.** Failed tool events stay loud on **Usage** (expanded, distinct treatment) during eval — not in Studio chat (ADR-0016).

## Explicitly not changing

- Vercel AI SDK thin loop (ADR-0001).
- Studio Project JSON as source of truth (ADR-0003).
- Remotion as assemble/export core (ADR-0002).
- No move to LangGraph / CrewAI / multi-agent orchestration.

## Rejected alternatives

- **HMAC "tool receipts"** (NabaOS-style). Correct in spirit, over-engineered for a single-operator runtime where we own both sides — the trace *is* the receipt.
- **Prompt-only fixes.** Proven insufficient across three reasoner families in our own traces.
- **Rewriting the harness onto a graph framework.** Would abandon the pattern shipped agentic editors converged on and add lock-in we do not need.

## Consequences

- Reliability precedes surface growth: Creative Factory, Brand DNA, and Campaign Packs (future ADRs 0019+) inherit the trust model. Building more surfaces on a fabricating agent multiplies fabrication surface.
- Slightly more code per verb (gates) and per generator (QC), in exchange for eliminating a whole class of user-visible lies.
- The `text` field of `RunTurnResult` becomes derived; downstream consumers must not assume the reasoner authored it verbatim.
