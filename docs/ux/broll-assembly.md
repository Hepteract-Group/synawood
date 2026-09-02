# B-roll assembly (operator UX)

Contract: [ADR-0049](../adr/0049-direct-branded-ad.md) (the ad), [ADR-0047](../adr/0047-intelligent-broll-assembly.md). Architecture: [broll-assembly.md](../architecture/broll-assembly.md).

## What the founder sees

1. Chat: **“Make a 45 second the private example ad.”**
2. Banner in the Studio chrome: **Assembling B-roll…** (not a button label). Survives modal close and reload.
3. **B-roll plan** modal when dry-run finishes: rows of library Moments, generate-to-fill jobs, optional music bed, £ estimate.
4. Confirm spend if estimate > £0 → **Apply plan**.
5. PIP lane (`track_broll`) shows new clips. Generation jobs keep the same persistent banner pattern as other generators.
6. Dismissing the modal does not cancel jobs; the banner remains until ready or failed.

Done = 30–120s with **video, music, and brand**. Missing any of the three is a fail banner, not a quiet success.

## Empty / failure

- No indexed shots: modal says to upload or wait for indexing; generate-to-fill still offered.
- Video off (**Edit only**): generate-to-fill rows are blocked with “Switch to broll-live, balanced, or high-fidelity (Video: Live clips) to generate video.” Library placement still works.
- Job fail: banner + Usage trace; plan row stays failed; founder can retry that row.

## Not this surface

- Story Builder remains Media bin search (whole assets).
- Director preview remains style/pacing plans. B-roll assembly may be invoked *from* a clip suggestion (“supporting B-roll”) but uses `assemble_broll`, not a bare `generate_video_clip`.
