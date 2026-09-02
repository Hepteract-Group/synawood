# ADR-0088 — Music-bed requests must call generate_music

**Status:** accepted  
**Date:** 2026-08-25  
**Issue:** [#1016](https://github.com/Hepteract-Group/marketing-os/issues/1016)  
**Extends:** [ADR-0055](./0055-reasoner-must-generate.md) (same harness pattern, music instead of video)  
**Amends:** [ADR-0019](./0019-studio-chat-narration-and-receipts.md) — third-person “the carousel now has a bed” is a music-done claim, not clarifying prose.

## Context

The founder asked for orchestral background music on a LinkedIn carousel. The reasoner wrote that a bed was on the audio track. Zero tools ran. Playback stayed silent.

ADR-0019 only stripped first-person edit claims (`I generated` / `I’ll add`). ADR-0055 already forced `generate_video_clip` on make-an-ad. Music had the hole, not the control.

## Decision

1. **First step:** when the user asks for a music bed, `generate_music` is enabled, and the audio track has no bed, the harness sets `toolChoice` so step 0 must call `generate_music`. Later steps stay free.
2. **After the loop:** if that rule applied and `generate_music` never ran (ok or fail), replace the bubble with the ADR-0055 copy shape: nothing was generated; this reasoner did not call tools; switch Reasoner or retry. Do not narrate a bed.
3. **Narration:** third-person music-done claims (`CLAIMS_MUSIC_DONE`) are replaced unless `generate_music` succeeded. A failed call (spend gate, ElevenLabs) counts as having tried — show that error.

A forced call that hits confirm-spend is a real tool result, not “nothing generated.”

## Consequences

- Overlay slide layouts are unchanged.
- Compartment (stacked / split) slide layouts are a separate issue.
- Do not auto-invoke `generate_music` outside the model loop.
