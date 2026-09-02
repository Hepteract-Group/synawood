# Runbook: Voice Studio

**Purpose:** Manage consented voice profiles, synthesize or dub spoken audio in that voice, remove filler words, and keep Approve honest about mock lip-sync.
**Cadence:** As needed when cutting talking-head or slideshow VO.
**Owner:** Founder (marketing operator).
**Time budget:** 2–5 minutes per line (network + confirm spend). Clone save adds ~10–30s for ElevenLabs.
**Automation status:** partially automated — Settings Voice (record/upload + clone) + Studio Voice panel + tools. Lip-sync vendors stay mock.

Contracts: [ADR-0033](../../docs/adr/0033-voice-studio.md), [ADR-0060](../../docs/adr/0060-live-voice-clone.md), plan 14 / epic [#213](https://github.com/Hepteract-Group/marketing-os/issues/213).

## Inputs

- Local review: `npm run dev:review` → `http://127.0.0.1:3011`
- Apply migrations `0037_voice_studio.sql` and `0044_voice_profile_sample.sql` on local Synawood Postgres
- TTS synth: `AI_GATEWAY_API_KEY` for founder profiles; `MODEL_PROFILE=ci-stub` for zero-spend
- Clone (live): same `ELEVENLABS_API_KEY` as music. Missing key fails loud; it does not silent-mock
- Consent: clone profiles only after checking the consent box **and** recording or uploading a sample (≥8s)

## Steps

### A — Create a clone (your voice)

1. Open **Settings → Voice**.
2. Name the profile. Kind = Clone.
3. Click **Record sample** and speak for at least 8 seconds, **or** upload a clean take.
4. Check **I have consent to clone this voice**.
5. **Save clone**. Done = profile listed as **ready for Voice Studio** (not “missing sample”).

Synth-only: skip the sample; Gateway TTS is enough.

### B — Synthesize or dub in Studio

1. Open a Studio project → Audio tab → **Voice Studio**.
2. Voice picker defaults to the latest ready clone. Confirm it is yours.
3. Paste a line. Dub: set the target language / locale. Note the £ estimate.
4. Check Confirm spend when the estimate is above £0 → **Synthesize** or **Dub line**.
5. Done = audio tile with a **Clone** (or **Synth** / **Dub**) badge; persistent banner while the job runs.

### C — Fillers

1. Synthesize with the clone first, then Transcribe that clip.
2. Voice Studio → Fillers. Clip labels include the profile name. Done = a cut list.
3. Apply cuts. Done = um/uh ranges ripple-deleted.

Fillers do not clone. They only scan a transcript.

### D — Approve

1. Export a completed render.
2. Mock lip-sync, mock clone (`ci-stub`), and clone-without-consent block Approve.
3. Live ElevenLabs clone with consent can Approve. Gateway TTS synth without a clone is allowed.

## Outputs

- `voice_profiles` (with `sample_blob_key` + `provider_voice_id` for clones) / `voice_events` / `dub_jobs` rows
- Audio assets with `probe.voiceProvenance` including `profileId`

## Escalation

| Symptom | What to do |
|---|---|
| Save clone blocked | Record ≥8s or upload; check consent. |
| `ELEVENLABS_API_KEY is required` | Set the same key used for music in `dashboard/.env.local` (and root `.env` for workers). |
| Voice Studio still uses Gateway TTS | Confirm the clone is **ready**; pick it in the Voice dropdown. |
| Approve blocked on mock lip-sync | Remove the lip-sync provenance or wait for a live vendor ADR. |
| Estimate > £0 | Check Confirm spend in the Voice panel / chat spend chrome. |
