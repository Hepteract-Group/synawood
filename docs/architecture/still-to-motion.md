# Still-to-motion

ADR-0023. Campaign pack cards can Animate a Path B still into a short clip.

## Flow

1. Card has `backgroundAssetId`.
2. **Animate** or **Animate without text** → estimate modal → Confirm spend.
3. Persistent banner while the generation job runs (poll `/api/studio/generation/[jobId]`).
4. `motionAssetId` (+ optional `motionJobId`) on the creative.
5. Export / Approve remain separate — raw clip is not Final.

## API

`POST /api/studio/projects/[id]/campaign/animate` with `creativeId`, `withoutText?`, `confirmSpend?`, `estimateOnly?`.
