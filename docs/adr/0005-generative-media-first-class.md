# Generative media is first-class (images + video clips)

Creative Studio **will** generate images and short video clips via Generator adapters, then assemble them (with captions, brand, founder footage when present) in Remotion.

**Why:** Replacing a video editor hire for ads/infographics requires creating media, not only trimming uploads. The original product intent includes AI image and video generators alongside audio and edit.

**How:** Image/Video/TTS/Transcription Generators return `AssetRef`s; Studio Tools `generate_image` / `generate_video_clip` / `generate_voiceover` / `transcribe_media` expose them; Remotion remains the compose/export core. Slow calls use Generation Jobs (async), same as Render Jobs. Live video clip bytes and profile gates: [ADR-0048](./0048-live-video-clip-generator.md). How those clips enter a cut: [ADR-0047](./0047-intelligent-broll-assembly.md).

**Rejected:** Treating generative video APIs as the only path when brand, music, or Approve would be skipped. Deferring all image/video gen indefinitely. Building a separate “generator app” outside Studio.

**Clarified by [ADR-0061](./0061-ai-media-surface.md):** `/ai-media` reviews Generation Jobs and their output assets. It does not grow a prompt box or new-generate composer. Retry of a failed job (ADR-0062) re-runs that job only. [ADR-0062](./0062-generated-asset-review.md) is how a ready asset is seen and placed onto a Studio Project.

**Amended by [ADR-0049](./0049-direct-branded-ad.md):** If generated video + music + brand already make a suitable 30–120s ad, that file may be the Final after Approve. Remotion is not required for its own sake.
