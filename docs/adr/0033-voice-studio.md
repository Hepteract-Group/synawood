# ADR-0033 — Voice Studio

**Status:** accepted  
**Date:** 2026-08-17  
**Amended by:** [ADR-0060](./0060-live-voice-clone.md) (live ElevenLabs clone + required sample; lip-sync still mock)  
**Wave:** Vision 2E · Plan index **14** · Epic [#213](https://github.com/Hepteract-Group/marketing-os/issues/213)  
**Related:** ADR-0005 (generators), ADR-0007 (model profiles), ADR-0010 (Approve), ADR-0018 (trust / cost), ADR-0041 (music), ADR-0043 (locale dub copy)  
**Corrects:** Epic [#213](https://github.com/Hepteract-Group/marketing-os/issues/213) children cited this ADR before the file existed. **This ADR is the contract.**  
**Does not supersede:** ADR-0043 — `dub_project_for_locale` remains copy + optional TTS, not lip-sync.

**Operator runbook:** [voice-studio.md](../../core/runbooks/voice-studio.md)

## Context

Founders need to replace, clone (with consent), translate, and clean spoken audio without a freelance VO artist. TTS/STT already exist (`openai/tts-1`, Whisper). Voice Studio adds **profiles, provenance, dub jobs, filler cuts, and a lip-sync quality floor**.

## Decision

### 1. Consent is mandatory for clone

A **voice profile** is product-scoped. Creating or using a **clone** requires `consentAt` (ISO timestamp) plus a recorded acknowledgement. Missing consent fails closed — tools and HTTP return a clear error; Approve also blocks cloned assets without consent.

Synth from the Brand kit `voiceId` (Gateway TTS) does **not** require a clone profile.

### 2. Model Profile roles

Profiles gain four Voice Studio roles (in addition to existing `speech` / `transcribe`):

| Role | v1 default | Live spend? |
|---|---|---|
| `voiceSynth` | same as `speech` (`openai/tts-1` / mock) | Yes on founder profiles |
| `voiceDub` | same as `speech` | Yes on founder profiles |
| `voiceClone` | `elevenlabs/eleven_multilingual_v2` on live profiles; `mock-voice-clone` on `ci-stub` | Yes on live (ADR-0060). Sample + consent required. |
| `voiceLipsync` | `mock-lipsync` | **No** — lip-sync provider not wired |

CI / `ci-stub` uses mock models at £0. Missing live keys never silent-swap to mock for synth/dub (same rule as TTS).

### 3. Provenance on assets + Approve gate

Generated speech/dub/lipsync assets store `probe.voiceProvenance`: `{ kind, profileId?, consentAt?, modelId, stub? }`. Approve blocks:

- Clone kind without `consentAt`
- Lip-sync `kind: lipsync` when `stub` / mock (not Final-eligible)
- Unknown provenance kinds fail closed

### 4. Tools

`synthesize_voice`, `translate_and_dub`, `lipsync_clip`, `remove_fillers`, `apply_cut_list`. Spend tools require `confirmSpend` when estimate > £0 (ADR-0018). Lip-sync quality floor: both a video clip and an audio clip; duration drift ≤ 15%.

`translate_and_dub` writes a `dub_jobs` row and TTS for the target locale. It does **not** lip-sync (call `lipsync_clip` separately). Distinct from ADR-0043 `dub_project_for_locale` (branch + copy).

### 5. UI

Product **Settings → Voice**: profile CRUD + consent. Studio **Voice** overlay (full-viewport panel, Music-panel pattern): synth / dub / fillers, persistent busy banner, poll after reload.

Audio tiles show provenance badges (Synth / Clone / Dub / Lip-sync / Mock).

## Consequences

- Plan 14 slices [#214](https://github.com/Hepteract-Group/marketing-os/issues/214)–[#226](https://github.com/Hepteract-Group/marketing-os/issues/226) implement this contract.
- Live clone is ADR-0060 (ElevenLabs Instant Voice Clone + sample). Lip-sync vendors still need a later ADR; lip-sync stays mock + quality floor.

## Rejected

- Shipping celebrity / third-party voice clone without consent records.
- Auto lip-sync on locale dub.
- Treating filler removal as a silent timeline rewrite (always a cut list the founder or tool applies).
