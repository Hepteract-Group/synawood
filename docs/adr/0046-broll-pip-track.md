# ADR-0046 — B-roll / picture-in-picture video track

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Studio chrome Phase 2b · [#49](https://github.com/Hepteract-Group/marketing-os/issues/49)  
**Related:** ADR-0002 (Remotion), ADR-0003 (project JSON), `docs/architecture/editable-timeline.md` Phase 2b  
**Does not supersede:** Phase 2a caption/overlay lanes remain separate track types.

**Amended by [ADR-0051](./0051-agent-watches-the-player.md):** Two picture tracks stay internally. Customers never see talking head / B-roll / PIP as product modes. Overlay is allowed only when main already has picture; a tiny corner on empty Main is a failed cut.

## Context

The timeline already stores `clips[].trackId`, but `ensureDefaultTracks` kept **one track per type**. A second video lane could not exist without stealing the main A-roll. Founders still need B-roll / PiP without hiring an editor.

## Decision

### 1. Stable ids, not one-track-per-type

Default tracks are id-based: `track_video` (A-roll), `track_broll` (B-roll, also `type: 'video'`), then audio / caption / overlay. Older projects keep their existing video track as A-roll and **gain** `track_broll` if missing. Extra custom tracks are preserved.

### 2. Aliases

`resolveTrackId` maps `broll` / `b-roll` / `pip` / `track_broll` onto the B-roll lane. Omitted `trackId` still means A-roll (`track_video`).

### 3. Composition

`toTalkingHeadProps` splits clips: A-roll is full-bleed until B-roll is on-screen; B-roll uses `project.pipLayout`. Layout is a 0–1 rect (`x`, `y`, `width`, `height`) plus `mode`:

- **`pip`** — A-roll stays full-frame; B-roll is an inset (default bottom-right).
- **`split`** — A-roll shrinks to `mainPct` of the frame; B-roll fills the rest (`side-by-side`, `news`). Both panes use `object-fit: contain` so neither picture is cropped or stretched. `mainSide` / `swap` flips which pane is A-roll.

Presets and freeform numbers are set with Studio Tool `set_pip_layout` (no spend) or the timeline **Picture layout** strip / drag handles on the player. Inset and split media use `object-fit: contain` so wide stills are not cropped. Path C logo/captions stay above both. Hidden tracks do not render; muted tracks silence audio.

HTTP: `GET`/`POST /api/studio/projects/[id]/pip-layout`.

### 4. Timeline

The B-roll lane is labelled **PIP**. Dropping an asset on that lane sends `add_clip.trackId = track_broll`.

## Consequences

- Slice [#49](https://github.com/Hepteract-Group/marketing-os/issues/49) implements this contract.
- Slideshow / campaign-pack compositions ignore `track_broll` in v1.

## Rejected

- Encoding PiP as overlay `kind` (clips already have a video track type).
- Auto-promoting a second video file onto PiP without an explicit track.
