# ADR-0043 — Localization (locale as a first-class axis)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision 2H · Plan index **23** · Epic [#324](https://github.com/Hepteract-Group/marketing-os/issues/324)  
**Related:** ADR-0003 (project JSON), ADR-0006 (brand kit), ADR-0013 (slideshow), ADR-0027 (variants), ADR-0030 (named branches), ADR-0042 (governance)  
**Corrects:** Epic [#324](https://github.com/Hepteract-Group/marketing-os/issues/324) children previously cited ADR-0042 (governance) by mistake — **this ADR is the contract.**  
**Does not supersede:** ADR-0042 — locale may *filter* claim rules (#333); it does not replace stages or the scanner.

## Context

One campaign should become many languages (copy, currency, RTL, local brand overlays) without rebuilding the timeline by hand. Voice Studio lipsync is not shipped; dub-for-locale in v1 is **copy + optional TTS**, not face lock.

Tickets pointed at a missing plan `23-localization.plan.md` and the wrong ADR.

## Decision

### 1. Locale lives on the Studio Project

BCP-47 codes (`en`, `en-GB`, `fr`, `ar`, `he`). `project.localization` holds:

- `defaultLocale` / `activeLocale` / `locales[]`
- `copy[locale]` — overlay, slide, and intent strings
- optional `money` `{ currency, amountMinor }`

Timeline `overlay.text` / slide headline+body stay the **resolved active locale** so Remotion and Approve scan one language. Switching locale snapshots the current strings into `copy[from]` then applies `copy[to]` (fallback: default locale).

### 2. Brand kit locale overlays

Default kit remains `products/<id>/brand-kit/`. Optional `brand-kit/locales/<locale>/*.json` deep-merges on top (missing file = default, not failure). Same rule as `music.style.json`.

### 3. Renderer

Compositions honor `textDirection` (`rtl` for `ar`/`he`/`fa`/`ur`). Font fallback: warn when the active locale needs a Noto family and `brand.fontFamily` does not mention Noto.

### 4. Translate and dub

- `translate_all_missing` fills empty `copy[locale]` keys from the default locale via a translator port. Default `applyToPreview: true` also switches `activeLocale` and applies that copy to the timeline; pass `false` to store translations without leaving the current preview. **v1** uses the stub (`[locale]` prefix) on every profile; live profiles still require `confirmSpend` so a later Gateway adapter cannot spend silently (ADR-0018). No Gateway translate adapter in this slice.
- `dub_project_for_locale` forks a named branch `locale-<code>` (ADR-0030) **and switches the project onto that branch** (main is no longer the active tip until you switch back). Lipsync waits on Voice Studio.

### 5. Variants and governance

- `VariantSpec.locale` is an optional matrix axis (#334).
- Claim rules may set `locales[]`; empty/omitted = all locales (#333). Override still cannot skip the scanner.

## Consequences

- Slices [#325](https://github.com/Hepteract-Group/marketing-os/issues/325)–[#336](https://github.com/Hepteract-Group/marketing-os/issues/336) implement this contract; [#337](https://github.com/Hepteract-Group/marketing-os/issues/337) is tests closeout if anything remains.
- Paid auto-translate still requires `confirmSpend` (ADR-0018).

## Rejected

- Storing every locale as a full duplicate Studio Project by default (variants already do platform×hook×CTA).
- Blocking export on missing translations (chips warn; founder may ship default-locale copy).
- Hard-coding the private example translated legal copy in `core/`.
