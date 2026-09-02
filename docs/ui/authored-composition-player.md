# Authored composition Player

Visual contract for agent-authored Remotion trees in Studio. UX: [authored-composition-flow.md](../ux/authored-composition-flow.md). Architecture: [authored-compositions.md](../architecture/authored-compositions.md).

## What the operator sees

The **same Player chrome** as talking-head: frame, transport, zoom, fullscreen, Export / Approve. Authored vs preset is not a mode switcher they have to pick.

Authored preview is an **iframe** behind that chrome. It must look like the Player they already have — same aspect, same black letterbox, same playhead. They do not see “sandbox,” origin URLs, or a second window.

## Compile / sandbox banner

Place: **directly under the player**, full width of the player column, above the transport if needed so it cannot hide under the timeline.

Copy (examples):

- Compile failed: “This motion ad didn’t compile. The agent has the error — ask it to fix, or say what you wanted instead.”
- Blocked import: “That composition used a blocked library. Ask in chat to rebuild with the motion kit.”

Dismiss does **not** clear the error. Reload still shows the banner until compile is green. X only hides for the session if we also keep a **workspace bar** status that the cut is broken — never status-only on a 10px pill.

## Seed / take

No extra inspector required in v1. Chat (“different glitter”) is enough. If we show a control later, it is a visible **New take** on the player chrome, not a buried seed hash.

## Format entry

New project **does** include a **Motion ad** format tile (#1326). Video Suite remains the footage cut. Chat footer **Craft** switches Footage ↔ Motion graphics on those two formats. Slideshow and Campaign Pack entry stay as they are ([format-entry.md](../ux/format-entry.md)).

## Layout

[studio-layout.md](./studio-layout.md) regions unchanged. The iframe replaces the in-page `@remotion/player` component when `compositionId === 'authored'`. First-party presets keep the in-page Player (no iframe required).

## Rules

- Path C logo and type remain visible in the iframe (wrapper is our code).
- Fullscreen uses the same contained fullscreen as today; the iframe goes with it.
- Do not flash a blank white frame while compiling — last good preview, or brand-field + spinner label “Building preview,” then swap.
