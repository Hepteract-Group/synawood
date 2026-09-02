# Studio layout

Studio is a **full-viewport editor** (ADR-0016), modeled on the founder sketch (`docs/ui/assets/studio-sketch-2026-07-19.jpg`). The route escapes the constrained dashboard content shell; the app sidebar collapses to give the editor the viewport.

## Regions

```
┌──────────────────────────────────────────────────────────────────┐
│ Workspace bar — headline · status/branch · Brand / Ad Generator · locale │
├───────────┬───────────────────────────────┬──────────────────────┤
│ Media bin │ Player + transport            │ Chat (full height)   │
│ (assets,  │ (Remotion preview, timecode,  │ Intent/Director tabs │
│  tabs,    │  play, zoom, fullscreen)      │ Agent conversation   │
│  drag-drop│  + review icons (one chrome)  │ composer · spend     │
├───────────┴───────────────────────────────┤                      │
│ Timeline (+ Scene strip) under player     │                      │
│ Track headers + lanes                     │                      │
│ Transcript pane (optional split)          │                      │
└───────────────────────────────────────────┴──────────────────────┘
```

- **Left — Media bin.** Top tabs: Media / Audio / Text / Stickers / Effects / Captions / Filters / **Artefacts**. Tabs swap the bin's content only — they never change Player or Chat. Media tab is the upload drag-drop zone and asset grid, with **Library | Story | Extracts** modes (ADR-0089). Artefacts is the plan + skills tree ([artefacts-pane.md](./artefacts-pane.md)). Other categories may ship as empty states until their plan lands.
- **Center — Player + review.** PlayerPane plus a single **player chrome** row under the player: transport (timecode, play, scrub, zoom, fullscreen) and review icons (Export / Approve / Back to draft / Discard — labels on hover). Authored compositions use an isolated iframe **behind the same chrome** ([authored-composition-player.md](./authored-composition-player.md)). Compile failures are a banner under the player, not a tab pill. Contained fullscreen keeps that chrome overlaid on the player.
- **Right — Chat.** Full viewport height beside player **and** timeline. Agent conversation owns the rail. Intent/Director are a one-line strip; expanded forms overlay the log instead of shrinking it. Composer and SessionSpend stay at the bottom. Tool traces live in Thoughts, not as the bubble.
- **Bottom-left — Timeline.** Sits under player/media only (not under chat). Resizable height. Scene strip sits above timeline toolbar for video compositions. **Transcript** may split this region ([transcript-pane.md](./transcript-pane.md)). Editing contract: `docs/architecture/editable-timeline.md`.
- **Chat grounding.** Composer chips for playhead / selected clip / overlay ([chat-grounding.md](./chat-grounding.md)).
- **Edits / why-log.** Open from chat or workspace; not a 10px pill ([ADR-0076](../adr/0076-why-log-and-targeted-regen.md)).
- **Review chrome.** Thumbnail picker on needs_review ([ADR-0077](../adr/0077-approval-thumbnails.md)).

## Rules

- Dividers between panes (and the timeline's top edge) are **draggable**; sizes persist in `localStorage`. Right-pane and timeline handles invert the drag delta (they sit on the far side of the element they size).
- **Collapse:** Media, Chat, Timeline, Transcript, and (for video) Scenes each have a hide control; collapsed panes become a thin **Media / Chat / Timeline / Transcript / Scenes** restore rail. Collapse flags persist in `localStorage` separately from resize sizes. Scenes can hide while the Timeline stays open.
- Reasoner / Image / Video model dropdowns live beside the chat send control (up-arrow idle, square stop while the agent is working — no separate Cancel). **Model choices** in the session row opens the catalogue; Frozen rows disabled. Brand chip stays in the **workspace bar**; SessionSpend in the **chat footer**; transport + review share one chrome row under the player. Generation Plan is a **modal + banner**, not a Send label. None stack against the player as competing panels.
- Empty chat shows **Studio Agent** title + tips inside the message log (not a permanent header block).
- Review actions stay available in player fullscreen (same chrome overlay).
- Soft-lock: while the agent is mid-turn (`chatPending`), the timeline shows "agent is editing…" and manual edits queue (see editable-timeline concurrency model).
- Mobile: stack Player → Chat → Media bin; timeline secondary/collapsed.
