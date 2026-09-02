# Runbook: Assemble picture from the library

**Purpose:** Build a 30-120s ad picture track from indexed footage first, then generate only the holes, without reading ADRs mid-session.
**Cadence:** As needed when cutting a product ad (often after indexing uploads).
**Owner:** Founder (marketing operator).
**Time budget:** 15-40 minutes once footage is indexed. Generate-to-fill adds vendor wait plus confirm spend.
**Automation status:** partially automated. Chat tools `find_moments`, `assemble_broll`, `commit_broll_plan`, `place_shot`, `generate_video_clip`. Plan modal + persistent job banner are [#523](https://github.com/Hepteract-Group/marketing-os/issues/523). Until that lands, use chat and the existing generate job banner.

Contracts: [ADR-0047](../../docs/adr/0047-intelligent-broll-assembly.md), [ADR-0048](../../docs/adr/0048-live-video-clip-generator.md), [ADR-0049](../../docs/adr/0049-direct-branded-ad.md), [ADR-0051](../../docs/adr/0051-agent-watches-the-player.md). Indexing: [studio-asset-intelligence.md](./studio-asset-intelligence.md). Intent: [intent-scenes-director.md](./intent-scenes-director.md). Music: [studio-music.md](./studio-music.md).

Do not call this a customer-facing "B-roll recipe." Picture lands on the **main** track unless you asked for overlay.

## Inputs

- Local dashboard: `cd dashboard && npm run dev` → `http://localhost:3000`. Synawood Supabase only (never the private example).
- A Studio project with at least one **uploaded video** in Media (library). Generated-only stills are not Moments until they are indexed video.
- Indexing chip settled on those clips (probe/shots at minimum). See [studio-asset-intelligence.md](./studio-asset-intelligence.md).
- Intent + Scenes named (hook / proof / CTA). Infer scenes if the strip is empty.
- Video generate **on** only if you expect generate-to-fill. **Edit only** can still place library Moments (no paid video).
- Brand kit on the project before generate-to-fill (ADR-0006).
- For live video: `AI_GATEWAY_API_KEY` in `dashboard/.env.local`. Confirm spend when £>0.

## Steps

### A. Index footage

1. Open the project → Media → Library. Upload product takes (not only stills).
   Done = files in the bin; indexing chip appears, then settles (ready, or probe/shots if paid stages skipped).
2. Reload while indexing. Done = chip still there (server state).
3. Optional chat: "find moments for export close-up." Done = Thoughts show `find_moments` hits with in/out, not the whole file.

### B. Intent and Scenes

1. Set Intent length (30-120s) and platform. Done = Intent chip is not "Not set yet."
2. Infer or add Scenes. Name roles: hook, proof, CTA.
   Done = Scene strip shows those roles. This is what "cover proof" means later.

### C. Assemble (chat until #523)

1. In Studio chat, say: **cover proof with close-ups** (or cover hook / CTA).
   Done = Thoughts: `find_moments` first with `sceneRole`, then `assemble_broll` (dry run). Player does **not** jump yet.
2. Read the chat plan: library Moments vs generate-to-fill vs music + £.
   Done = you know which holes will spend.
3. If the plan looks right: "commit the overlay plan" / "commit broll plan." Confirm spend if asked.
   Done = Moments land on the timeline (main unless you asked for overlay). Generate jobs, if any, show the **persistent generate banner** (not only a button label).
4. Minimize or reload. Done = banner still tracks the job. Approve stays gated until jobs finish.

Do not skip library Moments just because a video model is on. Do not stop at a 4s generated clip and call it the ad.

### D. Overlay / PIP lane (optional)

1. Only if you asked for picture-in-picture: chat "put the presenter on overlay, bottom-right" (or a split preset).
   Done = overlay lane has the clip; main picture stays visible (letterbox on split, never cover-crop).
2. Skip this section for a normal product ad. Generated picture belongs on **main**.

### E. Watch the player, then export Remotion

1. Play the cut. If chat claimed success but the player is stills or empty, it is not done. Ask to inspect / fix.
2. Add music if there is no bed ([studio-music.md](./studio-music.md)).
3. Human **Approve**, then **Export** MP4 (Remotion). Done = export job + file; Approve is never the agent's to claim.

## Outputs

- Timeline picture covering the brief length, with Scene roles attached where possible.
- Indexed Moments reused; generate-to-fill only for holes.
- Optional overlay layout.
- Remotion MP4 after Approve.

## Escalation

| Symptom | What to do |
|---|---|
| Video generate off / Edit only | Place library Moments only. Do not fake an ad with stills. Turn a video model on in the Video picker, then ask again. |
| Empty index / find_moments returns nothing | Index is not ready. Wait for the chip, Retry index, or upload real video takes. Do not generate first "to save time" if footage exists but is unindexed. |
| Generate is the first tool on "cover proof" | Wrong. Stop. Say "find moments for proof close-ups first." |
| Job failed / banner error | Read the banner copy. Confirm spend, check Gateway key, or switch video model. Do not narrate a Final ad. |
| Agent says the ad is Final / finished | Ignore. Approve is human-only. A Generator MP4 is still Draft. |
| Overlay covered the main picture | Ask for a split preset (side-by-side / news) or move PIP to a corner. |
| Pointed at the private example Supabase | Stop. Use `.env.local` Synawood project. |

## Change log

- 2026-08-20: Initial runbook (#528). Chat path until the plan modal (#523).
