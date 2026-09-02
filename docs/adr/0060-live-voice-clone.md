# ADR-0060 — Live voice clone (ElevenLabs)

**Status:** accepted  
**Date:** 2026-08-22  
**Wave:** Vision 2E follow-up  
**Related:** ADR-0033 (Voice Studio), ADR-0041 (ElevenLabs Music), ADR-0018 (spend)  
**Amends:** ADR-0033 §2 `voiceClone` was `mock-voice-clone` with no sample. **This ADR is the contract for live clone.**  
**Does not supersede:** ADR-0033 consent, provenance, lip-sync mock, or filler cut lists. Lip-sync stays mock.

**Operator runbook:** [voice-studio.md](../../core/runbooks/voice-studio.md)

## Context

Settings → Voice could save a clone profile with only a consent tick. Voice Studio never listed profiles or passed `profileId`, so synthesize/dub always used Gateway TTS (or the Brand kit voice id mapped onto OpenAI voices). Fillers scanned unlabeled clips. The founder could not provide a sample, so nothing was cloned.

## Decision

### 1. Clone requires a sample

A **clone** profile stores `sample_blob_key` (Azure Blob) plus `consent_at`. Creating a clone without a recorded or uploaded sample fails closed.

### 2. Live provider is ElevenLabs Instant Voice Clone

Same `ELEVENLABS_API_KEY` as music (ADR-0041). Creating a clone uploads the sample to ElevenLabs `POST /v1/voices/add` and stores `provider_voice_id`. Synthesize/dub with that profile calls ElevenLabs TTS (`eleven_multilingual_v2`) with that voice id.

| Path | Clone model | Sample | Spend |
|---|---|---|---|
| `founder-edit` and other live profiles | `elevenlabs/eleven_multilingual_v2` | Required | Yes; confirmSpend when £>0 |
| `ci-stub` | `mock-voice-clone` | Required (stored, not sent to ElevenLabs) | £0 |

Missing key on a live profile fails loud. Never silent-swap to mock.

### 3. Voice Studio always knows the product's voices

GET Voice Studio returns active profiles. The panel defaults to the latest ready clone, else the first synth profile. Synthesize and dub send `profileId`. Tools without `profileId` (agent) use the same default.

Filler clip labels include provenance (Clone / Synth / Dub) and the profile name when known. Fillers still operate on a transcript; they do not clone. The founder should synthesize with their clone, transcribe, then scan fillers.

### 4. Approve

Unchanged from ADR-0033: clone without consent and mock clone cannot Approve. A live ElevenLabs clone with `consentAt` can.

## Consequences

- Settings → Voice grows a recorder + file picker for clone.
- Model Profile `voiceClone` on live profiles is no longer `mock-voice-clone`.

## Rejected

- OpenAI TTS as the clone path (no instant clone from a founder sample).
- Shipping clone without a sample "for later".
- Auto lip-sync on cloned dub.
