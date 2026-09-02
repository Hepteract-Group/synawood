# States and feedback

## Shared status vocabulary

Use these strings in UI and Runbooks:

| Status | Meaning |
|---|---|
| `drafting` | Agent/human editing Studio Project |
| `rendering` | Render Job running |
| `needs_review` | Candidate ready for Approve/Kill |
| `approved` | Final asset written |
| `killed` | Explicitly dropped |

## Waiting

- Rendering: show progress or honest indeterminate + cancel if supported.
- Tool loops: show “Agent working…” with last tool name (e.g. `add_captions`), not a blank spinner.
- Failures: one sentence cause + next action (“Upload failed — try MP4 under 500MB”).
- **Generation Jobs** in the Studio workspace (image, video, music, speech): **toast** (X or ~4s) + **persistent banner** under the player. Not a blocking modal. Index jobs stay on the Media bin chip ([ADR-0087](../adr/0087-generation-toast.md)).
- Render / export / extract: **modal + persistent banner**, poll after reload.
- Authored composition **compile failure**: **persistent banner under the player** ([authored-composition-player.md](../ui/authored-composition-player.md)). Survives reload until compile is green. Not a tab pill.
- Long polish that occupies the player (speech enhance, reframe, thumbnail, transcribe) may still use a minimizable dialog **plus** the same banner ([editor-agent-polish.md](../architecture/editor-agent-polish.md)). Not a pill on a tab.
