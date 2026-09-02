# ADR-0054 — Collection looks: N tagged stills must appear in the clip

**Status:** accepted  
**Date:** 2026-08-20  
**Wave:** Vision **2I** correction · Epic [#512](https://github.com/Hepteract-Group/marketing-os/issues/512) · Issue [#612](https://github.com/Hepteract-Group/marketing-os/issues/612)  
**Related:** ADR-0050 (photo to life), ADR-0048 (live video), ADR-0051 (watch the player)  
**Does not replace:** ADR-0050 for a **single** tagged still.  
**Amends:** ADR-0050 multiple-stills paragraph — extra stills are not style-only refs; they are additional looks that must show up. Amends ADR-0051 brief rubric: outfit change is a **pass** when the founder tagged more than one product still.

## The product (read this first)

The founder tags two collection photos (two garments, two looks) and asks for an ad.

They must see **both** looks in the moving picture. A clip that only animates the first photo is a fail, even if both files were uploaded to the model.

One tagged still stays the existing product: that photo is the first frame and the identity. Do not invent a second outfit.

## Why this exists

#603 / #610 made extra `@asset` stills reach Seedance as `inputReferences` with `[Image 2]` in the prompt.

Okiki job `753d9137` sent `agbada1.jpg` + `agbada2.png`. The clip still showed one garment.

Cause: `SOURCE_IDENTITY_LOCK` is prepended on every i2v: “Animate this exact source photo… Keep the same person, product, garment silhouette.” That instruction wins over `[Image 2]`. Cut review also failed “outfits change,” so a successful two-look clip would have been punished.

Sending bytes is not enough. The prompt and the player review must treat extra stills as looks, not mood boards.

## Decision

### 1. One still — identity lock (ADR-0050 / #577)

When the generate has **one** product still:

- First frame / identity is that photo.
- Prompt keeps `SOURCE_IDENTITY_LOCK`.
- Later clips on the same ad reuse that still (wardrobe lock).
- Cut review fails brief if the garment/model swaps with no tagged second still.

### 2. Two or more stills — collection looks

When the generate has **two or more** product stills (tool args + this-turn `@asset`):

- `[Image 1]` is the opening frame.
- `[Image 2]`… are **other garments / looks that must appear** in the same clip (cut, second model, or wardrobe change). They are not “keep the same silhouette as photo 1.”
- Do **not** prepend `SOURCE_IDENTITY_LOCK`. That lock forbids the second look.
- Do not strip extras. Do not auto-attach untagged media-bin stills.

Prompt shape (normative intent, not a vendor string we freeze):

- Name each still `[Image n]`.
- Say `[Image 1]` opens the clip.
- Say every other `[Image n]` is a different product look that must be visible in the clip.
- Say do not invent extra looks beyond the tagged stills.

### 3. Inspect must fail a one-look collection ad

If MAIN has a generated clip whose probe lists extra `referenceImageAssetIds`, and the prompt still contains the one-photo identity lock, `inspect_preview` fails **before** vision (`missing_collection_look`). No credits story needed here — generate already ran; this stops “done” narration.

Live vision: when extra still refs exist, fail brief if sampled frames only show `[Image 1]`’s look. Do **not** fail brief only because wardrobe changed.

### 4. Veo

Veo takes one still. Two tagged stills still fail **before spend** (#603). This ADR does not invent a Veo two-look path.

## Consequences

- Fashion / catalog ads can show more than one piece without a second generate.
- Identity lock remains the default for a single product shot.
- Founder-visible inspect copy talks about the second look missing, not “outfits changed” as an error when they tagged two photos.

## Out of scope

- Auto-picking every still in the media bin.
- Guaranteeing a specific edit grammar (hard cut vs two models) — the vendor chooses, both looks must be recognisable.
- MiniMax / reasoner tool-calling (#613).
