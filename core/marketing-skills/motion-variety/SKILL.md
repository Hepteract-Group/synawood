---
name: motion-variety
description: Motion-graphics first pass. Use when they ask for kinetic type, stat slam, device/phone, Lottie, or authored motion — not a talking-head take.
category: video
locked: true
---

# Motion variety

Do not reuse the last fingerprint. Call `list_motion_kit`, then pick dialect + layout (`artDirection` or `pickArtDirection`). Six dialects exist for a reason: snappy, luxury, editorial, comic, brutalist, kinetic-stack. Layouts: full-bleed-type, split-stat, stacked-proof, device-hero, stinger-open. Never default every ad to snappy + full-bleed-type.

Path C logo is chrome, not the craft. Static type with a fade is a failed ad.

## First pass

1. Bind brand (`import_product_brand` if missing).
2. Pick art direction (dialect + layout).
3. Library-first assets if intelligence tools exist; else stills/brand as `inputProps`.
4. `write_composition`. Compiler errors → `patch_composition`. Never switch to `talking-head-60`.
5. `generate_music` if this is an ad.
6. `inspect_preview`.
7. Patch if inspect fails.

## Failed ads (do not ship)

- One centered sentence, opacity fade, no dialect spring.
- Talking-head-60 plus a hook overlay when they asked for kinetic type.
- Logo bug as the only motion.
