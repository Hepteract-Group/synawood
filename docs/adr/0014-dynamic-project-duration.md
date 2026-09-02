# Project duration is dynamic per project, not a fixed 60s preset

`StudioProject.durationFrames` is **project-owned state**, initialised from the composition preset but free to change as content changes. Compositions render to `durationFrames`, they do not dictate it.

**Why:** The `talking-head-60` preset hard-codes 1800f (60s at 30fps) into every project. A founder cutting a 10s upload gets 50s of dead air and an end card anchored at ~57s — broken output for the exact short formats the Studio exists to ship. Duration must follow content: `set_end_card` already anchors to the last clip end (see `END_CARD_GAP_FRAMES`), and compositions must read duration from the project, not the preset constant.

**Rules:**

- `COMPOSITION_PRESETS[*].durationFrames` becomes an **initial default** only. `createProject` may accept an explicit `durationFrames` override.
- `autoFitDuration` (on place/trim/delete/overlay edits) sets `durationFrames` to `lastContentEnd + padding` — it **grows and shrinks** with content so short cuts do not leave hour-scale dead air. Floor: `MIN_DURATION_FRAMES`; never below placed content.
- Explicit `set_duration` may lengthen beyond content; `fit_duration` / **Fit to content** snaps back to content + padding.
- Remotion compositions (`PlayerPane`, render worker) take `durationInFrames` from the project row. The preset supplies fps/width/height only.
- Pricing, render estimates, and the ≤60s channel constraint key off the project's actual `durationFrames`, not the preset name. The ≤60s rule stays a **validation ceiling** for Final assets, not a floor.

**Rejected:** Keeping duration fixed per composition (produces dead air and mis-anchored cards). Grow-only auto-fit (left 1h+ empty timelines after trims). Deriving duration only at render time with no reviewable project field.

**Migration:** existing oversized rows shrink on the next content edit, **Fit to content**, or Studio load when dead air exceeds ~30s.
