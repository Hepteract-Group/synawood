# ADR-0093 — MiniMax H3 video family (with Wan 3 smoke)

**Status:** accepted  
**Date:** 2026-08-31  
**Issue:** [#1070](https://github.com/Hepteract-Group/marketing-os/issues/1070) (Wan 3.0 picker + MiniMax H3 adapters, one founder smoke) · parent [#1006](https://github.com/Hepteract-Group/marketing-os/issues/1006)  
**Amends:** [ADR-0084](./0084-gateway-model-families.md) (family table — MiniMax H3 is the next video family after Wan 3, not “later / Kling”).  
**Does not supersede:** ADR-0084 add-model flow (adapter → live smoke → picker). [ADR-0085](./0085-catalog-freeze-and-remap.md) Live/Frozen. [ADR-0007](./0007-model-profiles.md) curated allowlist.

## Context

The founder will smoke **Wan 3.0** and **MiniMax H3** video ids in one local session. ADR-0084 already requires an isolated family adapter before a picker row. MiniMax on Gateway is easy to mis-wire:

| Gateway id | What it is | Studio role today |
|---|---|---|
| `minimax/minimax-h3` | Video (t2v / i2v / first-last / r2v, 2K, 4–15s) | **Not** allowlisted |
| `minimax/minimax-h3-max` | Video (faster, 480p/768p, t2v + start image, 5–15s) | **Not** allowlisted |
| `minimax/minimax-m3` | Language / tool-use reasoner | Already on the **reasoner** picker |

`minimax-m3` is **not** a video generator on Gateway. Registering the same id as `generateVideo` would steal or collide with the chat reasoner.

## Decision

### 1. MiniMax H3 is its own video family

Module: `core/creative/src/model-profiles/video-families/minimax-h3.ts` (same shape as `wan3.ts`). Do **not** send Veo 4/6/8 snaps or Seedance `[Image n]` tokens.

| Id | Picker label | Caps the adapter must encode |
|---|---|---|
| `minimax/minimax-h3` | MiniMax H3 | Duration **4–15s**. Resolution **2K**. t2v, i2v (first frame), first+last frames, `inputReferences` up to **9** (images/video; audio-in out of v1 unless smoke proves Gateway fields). Poll timeout minutes, not seconds. |
| `minimax/minimax-h3-max` | MiniMax H3 Max | Duration **5–15s**. 480p / 768p. **t2v + start image only** — no r2v / first-last unless smoke proves otherwise. Faster/cheaper than H3. |

Shared family code for duration snap and preflight; **per-id caps** so H3 Max never claims H3’s 2K refs.

### 2. MiniMax M3 stays the reasoner

`minimax/minimax-m3` remains in `GATEWAY_REASONER_MODELS` only. Do not add it to `GATEWAY_VIDEO_MODELS`. If a future MiniMax **video** SKU uses a different Gateway id, that is a new adapter row — not a reuse of M3.

### 3. Same ticket, one founder smoke

[#1070](https://github.com/Hepteract-Group/marketing-os/issues/1070) ships:

1. Wan 3 adapter (already in-repo) + MiniMax H3 family adapter.
2. Documented local smoke for Wan 3.0, H3, and H3 Max (`AI_GATEWAY_API_KEY`, spend approved). Fail per id = **no picker row** for that id.
3. Picker + catalogue for ids that smoked green. Frozen/Live from ADR-0085.

Do not wait for a new Vercel “MiniMax adapter” — Gateway already lists the ids (ADR-0084 §5 pattern).

## Consequences

- `resolveVideoModelFamily` grows `'minimax-h3'`.
- Tests: H3 fixture does not emit `[Image n]`; H3 Max preflight rejects extra refs; M3 is still a reasoner id, not a video family.
- Catalogue copy: H3 = quality 2K + refs; H3 Max = faster, shorter pipeline.

## Rejected

- Treating `minimax/minimax-m3` as a video generator.
- One MiniMax adapter that pretends H3 and H3 Max have the same caps.
- Shipping picker rows before local smoke.
