# ADR-0055 — Make-an-ad turns must call generate (every reasoner)

**Status:** accepted  
**Date:** 2026-08-20  
**Wave:** Vision **2I** · Epic [#512](https://github.com/Hepteract-Group/marketing-os/issues/512) · Issue [#613](https://github.com/Hepteract-Group/marketing-os/issues/613)  
**Related:** ADR-0001 (thin harness), ADR-0018 (trust model), ADR-0048 / 0049 (the ad), ADR-0007 (reasoner picker)  
**Does not replace:** ADR-0018. This is the **harness** fix for narrate-without-act on generate.  
**Amends:** ADR-0018 — prompt patches are not the control for “make a video.” The loop must require a tool call.  
**Amended by [ADR-0086](./0086-generation-plan-and-artefacts.md):** When Plan mode applies (paid generate, video on), the operator **Applies** a Generation Plan first. After Apply, this ADR still holds: make-an-ad must call `generate_video_clip` or fail visibly. Narrating the plan is not success.

## The product (read this first)

The founder picks a **Reasoner** (GPT, Gemini, MiniMax M3, Qwen, …) and says make an ad.

They must get a **clip**, or a **visible fail** in the chat bubble: this reasoner did not call tools; switch or retry. They must never get a polite paragraph and an empty player.

This is true for **every** allowlisted reasoner. MiniMax M3 is the bug that showed it. Do not special-case MiniMax. Do not silently swap in another model.

## Why prompt patches are not enough

ADR-0018 already named narrate-without-act. MiniMax (and any weak tool-caller) can reply in prose with **zero** `generate_video_clip` calls. `groundAssistantText` only strips claims that match “please wait / I generated.” A model that says “here is the plan” still looks like a successful turn.

The founder switched to MiniMax M3 on Okiki. Nothing generated.

## Decision

### 1. First step: require a tool when the turn is make-an-ad

When all of these are true:

- The user message is a make-video / make-ad request (same detector as cut review).
- `generate_video_clip` is enabled on the active profile (not Edit only / video off).
- Remaining brief still needs moving picture (≥ 1s).

the harness sets `toolChoice` so the **first** model step must call a tool (`required`). Prefer `generate_video_clip` when the SDK accepts a named tool. Later steps stay free so inspect/fix can run.

If video gen is off, do not force generate. Say generation is off (existing path).

If the brief is already covered with moving video, do not force another paid clip.

### 2. After the loop: no generate → no success

If the turn still has **no** `generate_video_clip` in `toolTrace` (ok or fail) and rule 1 applied:

- Replace the assistant bubble with a founder-visible error. Not a pill. Not a console log.
- Copy shape: nothing was generated; this reasoner did not call tools; switch Reasoner or retry.
- Do not narrate a finished ad. Do not invent a stills-only cut.

A **failed** `generate_video_clip` (spend gate, Veo cap, blob miss) **counts**. The founder sees that tool error. The bug is **zero** calls.

### 3. One reasoner, no silent fallback

Do not retry the same turn on GPT because MiniMax declined tools. The picker is the contract. Fail visibly.

## Consequences

- Weak tool-callers become loud failures instead of empty players.
- Eval / unit tests can pin: make-an-ad + text-only mock → error string, empty generate trace.
- Confirm-spend still applies; a forced `generate_video_clip` may return the £ confirm error. That is a real tool call. The founder can confirm. That is not “nothing generated.”

## Out of scope

- Making MiniMax as good as Gemini at wardrobe or collection looks.
- Auto-switching reasoners.
- Forcing generate on Edit only.
