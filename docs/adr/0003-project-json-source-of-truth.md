# Studio Project JSON is the source of truth

The editable unit is a versioned **Studio Project** document (tracks, clips, overlays, audio, captions, and optional **composition source**). Remotion compositions map that document to frames; Generators only produce assets referenced by the project; chat messages are not the source of truth.

**Why:** Survives agent retries, enables undo, MCP/external drivers, and Approve → Final asset without replaying chat. Surprising without this ADR because chat UIs often treat the transcript as state.

**Rejected:** Prompt history as timeline.

**0003 still holds:** chat is not the timeline. **Superseded clause:** the v1 reject of LLM Remotion codegen. Authored TSX is stored on this document and compiled in a sandbox.
