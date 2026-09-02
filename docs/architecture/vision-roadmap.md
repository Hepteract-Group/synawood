# Vision roadmap (Creative Studio)

High-level wave map for Studio after foundation Plans 00–07. Detail lives in ADRs + `.cursor/plans/generated/`. Issue epics carry acceptance; this file is the index.

| Wave | Name | Priority | Epic (typical) | Plan / ADR | Status notes |
|---|---|---|---|---|---|
| **2A** | Intent, Scenes, AI Director | P1 | [#135](https://github.com/Hepteract-Group/marketing-os/issues/135) | [plan 08](../../.cursor/plans/generated/08-intent-scenes-director.plan.md), [ADR-0026](../adr/0026-intent-and-scene-tree.md) / [0029](../adr/0029-ai-director-and-contextual-suggestions.md) / [0031](../adr/0031-multi-agent-as-skills.md) | Epic closed |
| **2B** | Ad Generator + variants | P1 | [#148](https://github.com/Hepteract-Group/marketing-os/issues/148) | [plan 09](../../.cursor/plans/generated/09-ad-generator-variants.plan.md), [ADR-0027](../adr/0027-ad-generator-and-variants.md) | Epic closed; runbook + coverage shipped |
| **2C** | Asset intelligence + Story Builder | P2 | [#162](https://github.com/Hepteract-Group/marketing-os/issues/162) | [plan 10](../../.cursor/plans/generated/10-asset-intelligence.plan.md), [ADR-0032](../adr/0032-asset-intelligence.md) | Index + Story Builder exist; shot-accurate B-roll is Wave **2I** |
| **2D** | Version tree / named branches | P2 | [#179](https://github.com/Hepteract-Group/marketing-os/issues/179) | [plan 11](../../.cursor/plans/generated/11-version-tree.plan.md), [ADR-0030](../adr/0030-version-tree-named-branches.md) | **Done** |
| **2E** | Music / Effects / Voice Studio | P2 | [#191](https://github.com/Hepteract-Group/marketing-os/issues/191) / [#202](https://github.com/Hepteract-Group/marketing-os/issues/202) / [#213](https://github.com/Hepteract-Group/marketing-os/issues/213) | [plan 12](../../.cursor/plans/generated/12-music-generation.plan.md) / [13](../../.cursor/plans/generated/13-effects-engine.plan.md) / [14](../../.cursor/plans/generated/14-voice-studio.plan.md), [ADR-0041](../adr/0041-music-generation.md) / [0045](../adr/0045-effects-style-packs.md) / [0033](../adr/0033-voice-studio.md) | Music shipped; Effects in progress; Voice Studio contract accepted |
| **2F** | Knowledge graph → Performance → Learning | P2 | [#227](https://github.com/Hepteract-Group/marketing-os/issues/227) / [#237](https://github.com/Hepteract-Group/marketing-os/issues/237) / [#250](https://github.com/Hepteract-Group/marketing-os/issues/250) | [plan 15](../../.cursor/plans/generated/15-creative-knowledge-graph.plan.md) / [16](../../.cursor/plans/generated/16-performance-ingestion.plan.md) / [17](../../.cursor/plans/generated/17-learning-agent.plan.md), [ADR-0034](../adr/0034-creative-knowledge-graph.md) / [0035](../adr/0035-performance-ingestion.md) / [0036](../adr/0036-learning-agent.md) | Structure + manual outcomes in tree; Learning is human-gated insights |
| **2G** | Teams / Public API / Marketplace / Autonomous | P2 | [#262](https://github.com/Hepteract-Group/marketing-os/issues/262) / [#273](https://github.com/Hepteract-Group/marketing-os/issues/273) / [#284](https://github.com/Hepteract-Group/marketing-os/issues/284) / [#297](https://github.com/Hepteract-Group/marketing-os/issues/297) | [plan 18–21](../../.cursor/plans/generated/), [ADR-0037](../adr/0037-functional-roles.md) / [ADR-0038](../adr/0038-public-api-v1.md) / [ADR-0039](../adr/0039-agent-marketplace.md) / [ADR-0040](../adr/0040-autonomous-marketing.md) | Marketplace + autonomous contracts accepted; teams + public API contracts accepted; billing still deferred |
| **2H** | Governance + Localization | P2 | [#310](https://github.com/Hepteract-Group/marketing-os/issues/310) / [#324](https://github.com/Hepteract-Group/marketing-os/issues/324) | [plan 22](../../.cursor/plans/generated/22-governance.plan.md) / [ADR-0042](../adr/0042-governance-approval-chains.md); [plan 23](../../.cursor/plans/generated/23-localization.plan.md) / [ADR-0043](../adr/0043-localization.md) | Governance #311–#323 shipped; localization #325–#336 |
| **2I** | Direct a 30–120s branded ad | **P1** | [#512](https://github.com/Hepteract-Group/marketing-os/issues/512) · quality bar [#549](https://github.com/Hepteract-Group/marketing-os/issues/549) | [plan 25](../../.cursor/plans/generated/25-intelligent-broll.plan.md), [ADR-0049](../adr/0049-direct-branded-ad.md) / [0050](../adr/0050-photo-to-life.md) / [0048](../adr/0048-live-video-clip-generator.md) / **[0051](../adr/0051-agent-watches-the-player.md)** | Ad = video + music + brand. Agent must **watch the player** (cut review required). No customer-facing recipes or spend profiles. |
| **2J** | Intelligence layer (visual shots + analyze-on-index) | **P1** | [#579](https://github.com/Hepteract-Group/marketing-os/issues/579) | [plan 26](../../.cursor/plans/generated/26-intelligence-layer.plan.md), **[ADR-0052](../adr/0052-visual-shot-embeddings.md)** / **[ADR-0053](../adr/0053-analyze-on-index.md)** | Same Index as Wave 2C (#162 closed). Visual shot embeddings required. Search / segment / compliance / highlights / reasoning are tools against it. Does **not** outrank P0 Studio bugs. Feeds #512 library-first Moments. |
| **2K** | Overlay library (Text, Captions, Stickers, Filters, Effects) | **P1** | [#692](https://github.com/Hepteract-Group/marketing-os/issues/692) | [plan 27](../../.cursor/plans/generated/27-overlay-library.plan.md), **[ADR-0057](../adr/0057-overlay-library-text-captions-stickers.md)** / **[0058](../adr/0058-filters-and-treatments.md)** / **[0059](../adr/0059-authorable-library-import.md)** | Founder **and** agent apply type/graphics/grades/treatments to timeline media. Pre-built packs + author/import. Amends ADR-0045 tab IA. Does **not** outrank P0 Studio bugs. |
| **2L** | Editor-agent polish (talking-head tools) | **P1** | [#866](https://github.com/Hepteract-Group/marketing-os/issues/866) | **[ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)**–**[0077](../adr/0077-approval-thumbnails.md)**, [editor-agent-polish.md](./editor-agent-polish.md) | Marketing **team** ships 30–120s branded ads. Transcript cut, chat grounding, first-pass policy, reframe, karaoke captions, why-log, approval thumbnails. **No** live multiplayer, clip mill, or named Producer recipe. Does **not** outrank P0 Studio bugs. |
| **2M** | Empowered agent-authored Remotion ads | **P1** | [#1180](https://github.com/Hepteract-Group/marketing-os/issues/1180) | **[ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)**, [authored-compositions.md](./authored-compositions.md) | Agent writes sandboxed Remotion TSX (kinetic type, Lottie, 3D, transitions, audio-reactive). Never refuse craft because another editor has it. Docs [#1181](https://github.com/Hepteract-Group/marketing-os/issues/1181). |
| **2N** | Creative constitution (marketing harness) | **P1** | [#1203](https://github.com/Hepteract-Group/marketing-os/issues/1203) | **[ADR-0092](../adr/0092-creative-constitution.md)**, [creative-constitution.md](./creative-constitution.md) | What to make and why: audience, one idea, proof, mute-robust, native platform, critic rubric. Skill packs, not 13 agents. Does not recreate 2M / #549 / #237. Source: [principles chat](https://chatgpt.com/share/6a909d42-dab4-83ed-8276-a393f782fae2). |

## Wave 2A — Intent, Scenes, AI Director (canonical)

**Contract**

- Architecture: [intent-and-scenes.md](./intent-and-scenes.md), [ai-director.md](./ai-director.md), [contextual-clip-suggestions.md](./contextual-clip-suggestions.md)
- UX: [intent-panel.md](../ux/intent-panel.md), [contextual-clip-panel.md](../ux/contextual-clip-panel.md)
- ADRs: [0026](../adr/0026-intent-and-scene-tree.md), [0029](../adr/0029-ai-director-and-contextual-suggestions.md), [0031](../adr/0031-multi-agent-as-skills.md)
- Plan: [08-intent-scenes-director.plan.md](../../.cursor/plans/generated/08-intent-scenes-director.plan.md)

**One-liner:** Editable Intent + Scene tree on project JSON → preview-first Director plan → contextual clip suggestions — single tool loop, no silent spend.

**Depends on:** Studio chrome (Plan 06). Unlocks richer `apply_brief` director mode for Wave 2B.

## Wave 2B — Ad Generator + variants (canonical)

**Contract**

- Architecture: [ad-generator-and-variants.md](./ad-generator-and-variants.md)
- UX: [ad-generator-flow.md](../ux/ad-generator-flow.md)
- ADR: [0027](../adr/0027-ad-generator-and-variants.md)
- Plan: [09-ad-generator-variants.plan.md](../../.cursor/plans/generated/09-ad-generator-variants.plan.md)

**One-liner:** URL/PDF → ExtractedBrief → parent first cut → platform × hook × CTA child projects → Approve with attribution.

**Depends on:** Studio chrome (Plan 06, shipped), brand-bound generators, Approve path. **Director (`#139`)** preferred for first cut; ADR-0027 defines **minimal** interim mode.

**Explicitly deferred:** paid ads APIs, marketplace billing. PiP track (#49) shipped. Live short B-roll clips + assembly are Wave **2I** (ADR-0047 / 0048), not a finished-ad generator.

## Wave 2K — Overlay library (canonical)

**Contract**

- Architecture: [overlay-library.md](./overlay-library.md)
- UX: [overlay-bin.md](../ux/overlay-bin.md)
- ADRs: [0057](../adr/0057-overlay-library-text-captions-stickers.md), [0058](../adr/0058-filters-and-treatments.md), [0059](../adr/0059-authorable-library-import.md) (amends [0045](../adr/0045-effects-style-packs.md) tab IA)
- Plan: [27-overlay-library.plan.md](../../.cursor/plans/generated/27-overlay-library.plan.md)
- Runbook: [overlay-library.md](../../core/runbooks/overlay-library.md)

**One-liner:** Founder and agent apply text, captions, stickers, grades, and treatments to timeline media. Pre-built packs plus author/import. One mutation pipeline.

**Depends on:** Studio chrome (Plan 06, shipped), ADR-0045 looks (shipped). Does not wait on marketplace billing (ADR-0039).

**Explicitly deferred:** CapCut/AE **project file** import. Agent-written GLSL shaders. `.cube` LUT shipped as v1.1 (#720). Lottie, clip transitions, and agent-authored Remotion TSX are Wave **2M** ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)) — not refused because CapCut has them.

## Wave 2L — Editor-agent polish (canonical)

**Contract**

- Architecture: [editor-agent-polish.md](./editor-agent-polish.md)
- UX: [talking-head-polish.md](../ux/talking-head-polish.md), [transcript-cut.md](../ux/transcript-cut.md), [chat-grounding.md](../ux/chat-grounding.md), [approval-thumbnail.md](../ux/approval-thumbnail.md)
- UI: [transcript-pane.md](../ui/transcript-pane.md), [chat-grounding.md](../ui/chat-grounding.md)
- ADRs: [0070](../adr/0070-studio-operators-are-a-marketing-team.md) (team, not one founder; veto live co-edit), [0071](../adr/0071-transcript-as-timeline.md), [0072](../adr/0072-chat-grounding.md), [0073](../adr/0073-talking-head-first-pass.md), [0074](../adr/0074-subject-tracking-reframe.md), [0075](../adr/0075-word-timed-captions.md), [0076](../adr/0076-why-log-and-targeted-regen.md), [0077](../adr/0077-approval-thumbnails.md)
- Gap: [../competitive/editor-agents.md](../competitive/editor-agents.md)

**One-liner:** Tools + agent policy so a marketing team can polish a talking-head take into a branded ad. Same Studio Agent. No second product.

**Depends on:** Overlay library (2K), Voice Studio cut list, ADR-0049 / 0051. Does not wait on MCP (#20).

**Explicitly deferred / vetoed:** see editor-agent-polish.md. Live multiplayer stays vetoed. Thumbnails live on Approve / Work board, not in the agent loop. Motion-graphics authorship is Wave **2M**, not a 2L deferral.

## Wave 2M — Empowered agent-authored Remotion ads (canonical)

**Contract**

- Architecture: [authored-compositions.md](./authored-compositions.md)
- UX: [authored-composition-flow.md](../ux/authored-composition-flow.md)
- UI: [authored-composition-player.md](../ui/authored-composition-player.md)
- ADR: [0091](../adr/0091-empowered-agent-authored-compositions.md)
- Epic: [#1180](https://github.com/Hepteract-Group/marketing-os/issues/1180)

**One-liner:** Studio Agent authors sandboxed Remotion composition source so advertisers get motion-graphics ads without hiring a designer. Presets stay; they are not the ceiling.

**Depends on:** Studio chrome (Plan 06), Path C, `inspect_preview` (ADR-0051), overlay library (2K). Does not wait on marketplace billing.

**Real limits:** security sandbox, spend confirm, brand/claims, frame-driven encode. Not “we’d look like CapCut.”

**Does not outrank** P0 Studio bugs.

## Wave 2N — Creative constitution (canonical)

**Contract**

- Architecture: [creative-constitution.md](./creative-constitution.md)
- ADR: [0092](../adr/0092-creative-constitution.md)
- Epic: [#1203](https://github.com/Hepteract-Group/marketing-os/issues/1203)
- Source: [Digital Marketing Agent Principles](https://chatgpt.com/share/6a909d42-dab4-83ed-8276-a393f782fae2)

**One-liner:** Teach the Studio Agent what to make and why it should work, as skill packs + brief fields + critic rubric — not 13 runtime agents.

**Depends on:** existing make-ad loop and `inspect_preview`. Does not wait on 2M sandbox to land skills/docs. Learning/fatigue waits on [#237](https://github.com/Hepteract-Group/marketing-os/issues/237).

**Does not recreate:** #1183 sandbox, #1184 motion kit, #549 player critic, #237 ingest, #324 localisation.

**Does not outrank** P0 Studio bugs or unblocked 2M tasks.

## Suggested execution order (from thought dump)

```
2A (Intent/Director) ──┐
                       ├─→ richer apply_brief
2B extract/schema ─────┘
2B variants UI → Approve attribution
→ 2D version tree → 2C asset intelligence → 2E → 2F → 2G → 2H
```

2B **schema + extract** may start before 2A UI; `apply_brief` in director mode waits on `#139`.

## Related OS / distribution (not a Studio wave)

- **Live Postiz adapter** — Plan 29, epic [#787](https://github.com/Hepteract-Group/marketing-os/issues/787), **[ADR-0063](../adr/0063-postiz-in-scope.md)** / [0064](../adr/0064-postiz-public-api-adapter.md) / [0065](../adr/0065-schedule-after-approve.md). Schedule after Approve. MCP stays [#20](https://github.com/Hepteract-Group/marketing-os/issues/20).

## Related shipped waves (context)

- Slideshow / infographics — ADR-0013, Plan 04, Epic #17 (closed).
- Editable timeline Phase 1 + 2a — Epic #42 (closed); Phase 2b PiP remains [#49](https://github.com/Hepteract-Group/marketing-os/issues/49) (P2).
