# ADR-0041 — Music generation (beds + brand style)

**Status:** accepted  
**Date:** 2026-08-16  
**Wave:** Vision 2E · Plan index **12** · Epic [#191](https://github.com/Hepteract-Group/marketing-os/issues/191)  
**Related:** ADR-0005 (generative media), ADR-0006 (brand-bound generation), ADR-0007 (model profiles), ADR-0018 (trust / cost), ADR-0010 (publish after approve)  
**Corrects:** Epic [#191](https://github.com/Hepteract-Group/marketing-os/issues/191) children previously cited ADR-0031 (multi-agent skills) by mistake — **this ADR is the contract.**  
**Does not supersede:** ADR-0005 — music is another first-class generator beside image/video/TTS.

**Operator runbook:** [studio-music.md](../../core/runbooks/studio-music.md)

## Context

Founders need under-60s beds and simple stings without hiring a composer or scraping stock. Plan 12 (`generate_music`, `music.style.json`, license gate, Music panel) was referenced by epic #191 but the plan file and a music ADR were missing. Voiceover already uses Gateway TTS (`openai/tts-1`); music is a different modality.

## Decision

### 1. Provider: ElevenLabs Music API (live by default)

A **music bed** is background underscore audio under voiceover/B-roll (usually instrumental, ≤60s for Studio formats) — not a full song product and not voiceover TTS.

| Option | Verdict |
|---|---|
| **Vercel AI Gateway** | **Not sufficient** for beds today. Catalog covers chat / image / video / TTS / STT — no dedicated music-generation model we can pin for `generate_music`. Keep Gateway for reasoner, caption, TTS, Whisper. |
| **Suno** | Strong song quality; **no stable public self-serve API** (partner-program exploration only as of mid-2026). Unsuitable as the Studio automation default. |
| **ElevenLabs Music** | **Chosen.** Public Music API (v1/v2), commercial-oriented terms for self-serve digital use, fits programmatic Generation Jobs. Voice stays on existing speech path; music is a separate adapter + model-profile **music** role. |

**Founder note (2026-08-16):** product path is **live** ElevenLabs generation with a real key — not mock as the local default. Mock exists only for CI / `ci-stub` when spend must be zero.

Pin concrete model IDs in the music Model Profile slice (#193) and document in `.env.example` as `ELEVENLABS_API_KEY` (name only). Swap adapters later if Gateway adds a real music model or Suno ships a self-serve API — do not hard-code vendor strings into Studio Tools.

### 2. First-class generator + license gate

- `generate_music` returns an `AssetRef` (audio) via Generation Jobs (async), same UX pattern as other slow generators (modal + persistent banner + poll).
- Persist **license / commercial-use metadata** on the generation row (#192); **Approve** blocks Final if music lacks an allowed license (#196).
- Cost estimate + soft caps (#197) before confirm spend (ADR-0018).

### 3. Brand kit: `music.style.json`

Product (and optional per-project) brand kit may include `music.style.json` — tempo, mood, avoid-vocals, reference notes — merged into prompts like other brand-bound generation (ADR-0006). Missing file = safe defaults, not failure.

### 4. Live-first; mock only for CI

- **Local / founder review:** require `ELEVENLABS_API_KEY` and call ElevenLabs Music for real beds (cost estimate + confirm spend still apply).
- **CI / `ci-stub`:** mock adapter writes a short fixture and marks license `mock` / non-publishable — never the founder default path.
- Missing key in non-CI → clear error (“set ELEVENLABS_API_KEY”), not silent mock substitution.

## Consequences

- Epic #191 children cite **ADR-0041** (not 0031).
- Plan file restored at `.cursor/plans/generated/12-music-generation.plan.md`.
- Founders need an ElevenLabs key with Music API access for live beds; TTS may continue on Gateway without that key.
- Legal: review ElevenLabs Music plan terms before paid ads / broadcast; film/TV exclusions may require Enterprise — document in the music runbook (#201).

## Rejected

- Relying on Vercel AI Gateway alone for music beds (no music model in catalog).
- Suno as v1 default (no self-serve API).
- Using ElevenLabs **voice** models as a stand-in for instrumental beds.
- Shipping music without a license gate on Approve.
- Celebrity / artist-style cloning prompts as a product feature.
