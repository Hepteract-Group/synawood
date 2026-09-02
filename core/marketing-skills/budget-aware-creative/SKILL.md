---
name: budget-aware-creative
description: Prefer low-cost creative paths when generator budget is tight. Use when cost caps loom, user asks for cheaper options, or before generate_video_clip.
---

# Budget-aware creative

## Order of preference (cheapest first)

1. Uploaded footage + captions + brand chrome
2. Brand kit stills + Remotion motion/type
3. `generate_image` stills + Remotion
4. Short `generate_video_clip` (image-to-video from branded still)
5. Multiple generated clips (only after they confirmed spend)

## Tool hints

- Check remaining weekly/monthly generator cap before video gen.
- Prefer uploaded footage and stills before generating video. Confirm when the estimate is above £0.
- Never treat a raw expensive clip as Final — still assemble in Remotion.
