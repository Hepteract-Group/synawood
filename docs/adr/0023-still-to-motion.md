# ADR-0023 — Still-to-motion for Campaign packs

**Status:** accepted  
**Date:** 2026-08-16  
**Related:** ADR-0021 (campaign packs), ADR-0005 (generative media), [#113](https://github.com/Hepteract-Group/marketing-os/issues/113)

## Decision

1. Animate uses image-to-video (`generate_video_clip`) from `backgroundAssetId`.
2. Result attaches as `motionAssetId` only — never auto-Final.
3. UX: estimate modal → confirmSpend → persistent banner; `motionJobId` survives reload.

**Amended by [ADR-0050](./0050-photo-to-life.md):** The same image-to-video generator is available in Studio for **any** image + prompt + duration, not only Campaign pack cards. Campaign Animate stays one button on that path.

## Rejected

- Baking Path C text into the motion clip as the Final.
- Silent spend without confirm when estimate > £0.
