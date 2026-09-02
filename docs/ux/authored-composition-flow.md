# Authored motion-graphics ads (operator flow)

How a marketing team gets a motion-graphics ad without becoming the motion designer. Architecture: [authored-compositions.md](../architecture/authored-compositions.md). UI: [authored-composition-player.md](../ui/authored-composition-player.md). ADR: [0091](../adr/0091-empowered-agent-authored-compositions.md).

## What the operator does

1. Open Studio → **New project**. Pick **Motion ad** (or Video Suite, then Craft → Motion graphics in chat). They do not need to type “kinetic”.
2. Chat: describe the ad. Attach a still or leave it to Extracts / generate. Mode **Plan** first if they want a scene list before Execute.
3. Watch the **Player**. Type should move. Logo should be there. Music if they asked for an ad (ADR-0049).
4. Direct: “harder spring,” “put the app in a phone,” “captions on the beat,” “different glitter.”
5. Export → Render Job → Approve. Same review chrome as talking-head.

They never open a TSX file. They never keyframe a graph. Timeline remains for footage if they want it.

## What they see while it works

- Agent turn: existing “Agent working…” with the last tool (`write_composition`, `generate_music`, …).
- First authored preview: Player shows the composition, not a placeholder card that says “compiling.”
- Compile failure: **persistent banner under the player** — one sentence + “The agent can fix this in chat.” Not a pill on a tab, not console-only. Banner survives reload until compile succeeds or they leave authored mode.
- Render / 3D-heavy export: existing render **modal + persistent banner** ([states-and-feedback.md](./states-and-feedback.md)).
- Seed change (“different glitter”): Player updates; no spend unless generate also runs.

## Empty and error states

| State | Surface |
|---|---|
| No brand | Player still plays; Path C uses defaults; copy in chat: Brand Studio sets logo and type |
| Compile error | Banner under player + agent gets the compiler line |
| Sandbox blocked an import | Same banner: “That composition used a blocked library. Ask in chat to redo with the motion kit.” |
| Signed URL expired | Existing asset refresh; not a sandbox mystery |
| Agent wrote a talking-head preset when they asked for kinetic type | Operator says so in chat; do not hide that the preset ran |

## Agent

Chat can do every motion action via tools. The operator must not need a hidden “Motion” mode. After `write_composition`, `inspect_preview` still runs on make-ad turns (ADR-0051). Narrate what moved (receipt), not the TSX.

## Non-goals for this flow

- Teaching the operator Remotion
- A second Studio product for motion vs video
- Live multiplayer on the composition (ADR-0070)
