# Remotion is the assemble / preview / export core

Preview and export for Creative Studio use **Remotion 4** compositions driven by the Studio Project document. FFmpeg is allowed for probe, trim helpers, and edge compositing — not as the primary creative timeline.

**Remotion is not the only place media comes from.** AI Image and Video Clip Generators (and uploads/TTS) feed assets into the project; Remotion composes them into the Final asset. See [ADR-0005](./0005-generative-media-first-class.md) and [generators.md](../architecture/generators.md).

**Why:** Remotion fits our React/TS stack, keeps motion graphics/brand frames in code (reviewable), and matches chat/tools → project → preview/export. Hard to reverse once compositions accumulate.

**Rejected:** Pure FFmpeg as the editor model. CapCut-like OSS as system of record.

**Amended by [ADR-0049](./0049-direct-branded-ad.md):** The product is a 30–120s ad with video, music, and brand. Remotion is a way to preview and encode a timeline. It is not a reason to refuse a complete ad. Using a video model with no Studio Project at all is still wrong when brand, music, or Approve would be skipped.

**Amended by [ADR-0091](./0091-empowered-agent-authored-compositions.md):** Compositions may be first-party presets **or** project-owned authored TSX compiled in a sandbox. Motion graphics in code was the original reason to pick Remotion; the agent now writes that code. Unsandboxed `eval` in the worker is still rejected.

