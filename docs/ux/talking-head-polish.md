# Talking-head polish

Operator-facing flow for [ADR-0073](../adr/0073-talking-head-first-pass.md), [0074](../adr/0074-subject-tracking-reframe.md), [0075](../adr/0075-word-timed-captions.md), [0076](../adr/0076-why-log-and-targeted-regen.md).

There is **no** “Producer” or “Quick Design” button. They talk to the **Studio Agent** (or use the transcript / captions / effects chrome). The agent runs the pass.

## What they see

1. **Chat** — “Make this take a 45s ad” (or polish). Narration: what changed, in order.
2. **Banner** while enhance / reframe / transcribe runs: “Cleaning speech…” / “Reframing to 9:16…”. Minimize the start **modal**; banner stays.
3. **Player** — captions pop, music ducks, zooms on splices. If they cannot see it on the player, it did not ship.
4. **Edits** — why-log panel (from chat or a workspace control). Rows like “Ducked music under speech.” **Regenerate this** on a row.

Volume duck, jump-cut zooms, SFX: fast — player updates; no fake progress chip on Export.

## Can they miss it?

Status is the **banner + player**, not a reasoner dropdown or a disabled Send label. Why-log is a **panel**, not only Thoughts.

Reframe complete: player switches to the new aspect crop. If they had 16:9 selected in variants, say that in narration.

## Dismiss / reload

Jobs persist. Banner comes back from poll. Why-log is on the **Studio Project** so another team member sees it ([ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)). Closing the modal does not cancel enhance.

## Backend

Enhance and reframe need a worker. Local: banner if missing. Duck / zooms / caption style / SFX do not.

## Caption style

Captions tab chips: Band / Karaoke / Highlights / Emoji ([ADR-0075](../adr/0075-word-timed-captions.md)). First pass picks karaoke + sparse emoji. Operator can strip emoji in the inspector. Change is visible on the player.

## Targeted regen

Select an effect on the timeline or a why-log row → **Regenerate this**. Whole-cut Director dry-run stays a different action.

## Non-goals

Avatars, eye contact, skin smooth, green screen, in-agent post, clipping mill.
