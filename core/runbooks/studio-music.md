# Runbook: Studio music beds

**Purpose:** Generate live instrumental music beds (ElevenLabs), place them on the audio track, and ensure Approve only proceeds when licenses are cleared.
**Cadence:** As needed when cutting ≤60s ads/tips that need underscore.
**Owner:** Founder (marketing operator).
**Time budget:** 1–3 minutes per bed (network + confirm spend).
**Automation status:** partially automated — Music panel + `generate_music` tool; Approve license gate; CI uses mock only.

Contracts: [ADR-0041](../../docs/adr/0041-music-generation.md), plan 12 / epic [#191](https://github.com/Hepteract-Group/marketing-os/issues/191).

## Inputs

- Local review: `npm run dev:review` → `http://127.0.0.1:3011`
- `ELEVENLABS_API_KEY` in `dashboard/.env.local` **and** root `.env` (Music API access verified)
- Brand kit optional `products/<id>/brand-kit/music.style.json` (the private example ships one)
- Model profile with music enabled (`founder-edit` or any GEN profile; not needed for `ci-stub` demos)

## Steps

### A — Generate from Music panel

1. Open a Studio project → Media bin → **Audio** tab.
2. Click **Generate music bed**. Done = Music panel modal opens (Minimize keeps a banner if a job just finished).
3. Edit prompt / duration (3–120s). Note the estimate (£).
4. Check **Confirm spend** (or confirm in the dialog) → **Generate bed**. Done = bed appears under Audio, placed on the audio timeline; Recent beds lists license status.

### B — Generate from chat

1. Ensure Confirm spend is checked in the session spend chrome when estimate > £0.
2. Ask the agent to generate a music bed (tool `generate_music`). Done = same asset + `music_generations` row.

### C — Approve gate

1. Export a completed render as usual.
2. If any project music row is `mock` / not commercial, Approve fails with a clear license error.
3. Live ElevenLabs beds default to `cleared` + commercial allowed (self-serve digital). Film/TV may need Enterprise — see license notes on the row.

## Outputs

- Audio asset (`source=generator`, probe `role=music_bed`)
- `music_generations` row with license fields
- Optional timeline clip on the audio track

## Escalation

| Symptom | What to do |
|---|---|
| `ELEVENLABS_API_KEY is required` | Add key; restart Next. Studio will **not** silent-mock. |
| 403 / permission from ElevenLabs | Enable Music generation on the API key; paid plan required. |
| Approve blocked on license | Replace mock beds or remove non-cleared `music_generations` for the project. |
| Estimate asks for confirmSpend | Check Confirm spend / confirm dialog — soft caps still apply. |
| Wrong mood/tempo | Edit `products/<id>/brand-kit/music.style.json` and regenerate. |

## Change log

- 2026-08-17 — Initial music runbook (#201) for Wave 2E.
