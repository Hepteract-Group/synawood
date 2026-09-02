# Editor-agent polish (Wave 2L)

Contract index for talking-head tools the Studio Agent (and operators) run so a **marketing team** can ship 30–120s branded ads without a freelance editor.

**Epic:** [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Operators:** [ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md) — team via Product membership; **no** live multiplayer.  
**Gap + vetoes:** [../competitive/editor-agents.md](../competitive/editor-agents.md)

Does **not** outrank P0 Studio bugs. Does **not** add a customer-facing “Producer” recipe ([ADR-0049](../adr/0049-direct-branded-ad.md) / [0051](../adr/0051-agent-watches-the-player.md)).

## Map

| Slice | ADR | Architecture / UX / UI |
|---|---|---|
| Transcript as cut | [0071](../adr/0071-transcript-as-timeline.md) | this file · [transcript-cut.md](../ux/transcript-cut.md) · [transcript-pane.md](../ui/transcript-pane.md) |
| Chat grounding | [0072](../adr/0072-chat-grounding.md) | [chat-grounding.md](../ux/chat-grounding.md) · [ui/chat-grounding.md](../ui/chat-grounding.md) |
| First pass (enhance, duck, SFX, jump-cut zooms) | [0073](../adr/0073-talking-head-first-pass.md) | [talking-head-polish.md](../ux/talking-head-polish.md) |
| Subject-tracking reframe | [0074](../adr/0074-subject-tracking-reframe.md) | talking-head polish (reframe job) |
| Karaoke captions + emoji/highlights | [0075](../adr/0075-word-timed-captions.md) | overlay library + overlay bin |
| Why-log + targeted regen | [0076](../adr/0076-why-log-and-targeted-regen.md) | talking-head polish · studio layout Edits |
| Thumbnails at Approve | [0077](../adr/0077-approval-thumbnails.md) | [approval-thumbnail.md](../ux/approval-thumbnail.md) |

## Tools (target)

Existing: `remove_fillers`, `build_cut_list`, `apply_cut_list`, `add_captions` / `captions_from_transcript`, `apply_effect` (`zoom_punch`), `generate_music`, `inspect_preview`.

| Tool | Job | Async? |
|---|---|---|
| `build_cut_list` | Propose um / pause / repeated-take / off-topic ranges | Deterministic except `clarity` (operator-marked) — **#871** |
| `apply_cut_list` | Remove ranges; captions in the window follow the picture | No — **#871** |
| `edit_for_clarity` | Wrapper for `clarity` ranges + confirm if large | Optional |
| `enhance_speech` | Noise/echo → new audio on clip | **Generation Job** |
| `duck_music` | Music envelope under speech | No |
| `place_sfx` | First-party pack item at a time | No |
| `apply_motion_preset` | Named `apply_effect` pack (`hook_punch`, `cta_hit`) — not new primitives | No |
| `apply_jump_cut_zooms` | `zoom_punch` on cut-list splices | No |
| `reframe_clip` | Subject-tracking pan/scan | **Job** |
| `set_caption_style` | Karaoke / highlight / emoji flags | No |
| `regen_effect` | Re-run one treatment / overlay / SFX / B-roll window | Job if generate |
| `generate_thumbnail` | Review-surface only — **not** required in the agent loop | **Job** |

Chat grounding is **not** a tool. Tokens + `grounding` on the turn ([ADR-0072](../adr/0072-chat-grounding.md)).

## First-pass order

Agent policy on talking-head ads ([ADR-0073](../adr/0073-talking-head-first-pass.md)): enhance → cut list → jump-cut zooms → captions (0075) → music + duck → SFX/motion pack → brand chrome → `inspect_preview` → why-log. Skip inapplicable steps. No named UI mode.

## Jobs (UX-first)

Enhance, reframe, transcribe, thumbnail, and any paid generate: **toast + persistent banner** in the Studio workspace ([ADR-0087](../adr/0087-generation-toast.md)). Render / export keep a minimizable dialog. Poll server after reload. Never gate Approve/Export on a client-only flag. Local dev: banner says when the worker is required and not running.

## Deferred (not this wave)

Auto layouts fit/split/fill; center active speaker; heal jump cuts with face regen; highlight reel product; prompt slash-commands; screenshot-to-chat; live lipsync vendor; remaining keyboard shortcuts; social copy / analytics as GTM.

Quote cards / stat charts, clip transitions, Lottie, and agent-authored Remotion TSX are Wave **2M** ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)), not a 2L never.

## Vetoed (do not ticket)

Viral clip mill, Recreate, avatars, Eye Contact, green screen, multicam, Rooms, rewrite-what-was-said, Premiere XML, stock GIFs, in-agent post, live multi-editor, 30/70 gameplay, chapters, censor SKU, skin smoothing, copying Opus/Descript MCP (ship **our** tools over MCP — [#20](https://github.com/Hepteract-Group/marketing-os/issues/20)).
