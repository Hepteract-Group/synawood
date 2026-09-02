# ADR-0091 — Empowered agent-authored Remotion compositions

**Status:** accepted  
**Date:** 2026-08-27  
**Amended:** 2026-08-30 — Create Project shows a **Motion ad** tile; chat footer **Craft** (Footage / Motion graphics) injects craft for the turn (#1326). Operators are not required to type “kinetic”. Dialect/layout stay agent-picked (not extra recipe tiles).  
**Wave:** Vision **2M** · Epic [#1180](https://github.com/Hepteract-Group/marketing-os/issues/1180) · Docs [#1181](https://github.com/Hepteract-Group/marketing-os/issues/1181)  
**Architecture:** [authored-compositions.md](../architecture/authored-compositions.md)  
**UX:** [authored-composition-flow.md](../ux/authored-composition-flow.md)  
**UI:** [authored-composition-player.md](../ui/authored-composition-player.md)

## Supersedes (clauses, not whole ADRs)

| ADR / doc | Clause that is **out** |
|---|---|
| [ADR-0003](./0003-project-json-source-of-truth.md) | “Direct LLM codegen of arbitrary Remotion TSX” rejected as the v1 edit model |
| [docs/architecture/timeline-model.md](../architecture/timeline-model.md) | “v1 does not compile model-written TSX” |
| [ADR-0016](./0016-studio-editor-chrome.md) | “we do not chase feature count (no transitions/keyframes/speed ramps)” as a **reason to refuse craft** |
| [ADR-0058](./0058-filters-and-treatments.md) | “Transitions stay out of v1 Effects” as a **ceiling on ads** |
| [ADR-0059](./0059-authorable-library-import.md) | “The agent never writes … Lottie, or Remotion TSX”; Lottie JSON import **No** |
| [creative-studio.md](../system-design/creative-studio.md) | Non-goal “Arbitrary LLM-authored Remotion components every turn” |
| [non-goals.md](../ux/non-goals.md) | “Lottie / GIF stickers in v1”; “Agent-written shaders or Remotion TSX as custom effects” |
| Success/kill language | “Looks like CapCut” / “don’t expand the Studio feature surface” used to **neutering the agent** |

Those ADRs **otherwise stand**: project JSON is still the source of truth; dual front-end chrome still stands; overlay library still stands; grades/treatments still stand; license gates still stand.

## Does not supersede

- [ADR-0001](./0001-studio-agent-harness.md) — thin tool loop, not LangGraph.
- [ADR-0002](./0002-remotion-render-core.md) — Remotion is still preview/export.
- [ADR-0003](./0003-project-json-source-of-truth.md) **except** the codegen reject — chat is still not the timeline. Authored TSX **lives on the Studio Project**.
- [ADR-0049](./0049-direct-branded-ad.md) / [ADR-0051](./0051-agent-watches-the-player.md) — ad = video + music + brand; agent still watches the player.
- [ADR-0070](./0070-studio-operators-are-a-marketing-team.md) — no live multiplayer.
- Unsandboxed `eval` in the dashboard origin or the render worker — still rejected (security).
- CapCut / Premiere / AE **project file** import as the Studio document — still out. We author in Remotion. That is “we are the editor,” not feature-fear.
- Random GIPHY/GIF stickers without a license — still a brand/license problem.

## The product

A marketing team tells the Studio Agent to make an ad. They get one they can Approve **instead of hiring an editor or a motion designer**. Talking-head, kinetic type, 3D device, Lottie stinger, audio-reactive captions, custom transitions — whatever advertisers will actually run.

Overlap with CapCut, Descript, Opus, Premiere, or After Effects is **not a reason to refuse**. Neutering the agent so Studio “doesn’t look like an NLE” is how ads become slop (four rigid compositions, same fade, same end card).

**Founder veto:** do not block agent-authored compositions because generated video/images are already non-reproducible, or because two agent turns might write different TSX. Store the take. Re-render of **saved source + saved assets + saved seed** is frame-identical. That is stricter than Veo.

## Decision

### 1. The agent authors composition source

The Studio Agent **writes and edits Remotion TSX**. That source is a versioned field on the **Studio Project** (`compositionSource` + `motionSeed`). Preview and export compile it. Operators direct in **chat**. They are not the motion designer. The timeline still exists for footage. It is not the only way to build a motion-graphics ad.

First-party presets (`talking-head-60`, slideshows, campaign stills) remain as defaults and fallbacks. They are not the ceiling.

### 2. Security sandbox — the real limit

Hostile TSX from prompt injection must not read Azure / Supabase / Postiz secrets or the operator session.

**Three rooms:**

1. **Worker (Node)** — holds secrets, signs blob URLs, starts Chromium. Never executes model TSX as Node.
2. **Compiler** — isolated webpack. Allowlisted imports only. **No** env `DefinePlugin`. Cannot import persistence, dashboard routes, or Node builtins.
3. **Chromium** (Player iframe + renderer) — runs the bundle. Sees motion kit + Remotion + `inputProps` (signed asset URLs, brand, copy, seed). Cannot see `process.env`, cookies, or `fs`.

**Player:** authored preview runs in an **isolated iframe** (`sandbox` without `allow-same-origin`, or a separate origin). Parent `postMessage`s props. The iframe cannot read `document.cookie` or call `/api/studio` as the user.

**Network:** Chromium may load signed project asset URLs. Outbound to arbitrary hosts is blocked.

**Compile gate:** every `import` on the allowlist; ban `process`, `fs`, `child_process`, `eval`, `new Function`, `Worker`, `WebSocket`, `document.cookie`. Fail closed with a loud, recoverable banner. Path C chrome **wraps** the authored tree. Claim scan reads text from kit components / the compiled tree, not only `overlays[]`.

Unrestricted `eval` of model output in the worker or dashboard origin is rejected. Authored TSX **inside this sandbox** is the product.

### 3. Motion kit — the agent’s library

The agent is not dropped into an empty file. Webpack resolves:

- `remotion` and `@remotion/*` (transitions, lottie, three, captions, media-utils, shapes, paths)
- `@synawood/creative/motion-kit` — first-party ads API (kinetic type, count-up, device/phone, Lottie stinger, wipes, audio-reactive captions, `BrandText`)

Tools: `list_motion_kit`, `write_composition`, `patch_composition`, plus existing generate/place/`inspect_preview`/`render_export`. Kit `.d.ts` (or catalog) is in the system prompt. Compiler errors return to the agent next turn.

If the kit is not enough, raw Remotion against the allowlist is still allowed.

### 4. Frame-driven encode and seeding

Motion must be a pure function of `useCurrentFrame` (`interpolate`, `spring`). CSS transitions that flicker are **translated** to frame-driven primitives — not dropped.

`Math.random()` is forbidden in composition source. Use Remotion `random(seed)`. `project.motionSeed` is stored on the document so glitter/jitter matches preview and export. Changing the seed is a new take, still stable.

This is **not** Veo “same prompt same pixels.” It is “this saved formula does not shimmer.”

### 5. Remotion craft is in-scope as useful product

| Craft | Product shape |
|---|---|
| Kinetic type | Headline / proof / CTA springs — highest-leverage MG ad |
| Stat / count-up | Catalog numbers, not invented proof |
| Lottie | Licensed brand stingers and icon loops on the Product library. Not GIPHY |
| Audio-reactive captions / type | Hits land on music or SFX |
| Custom transitions | `TransitionSeries` + custom presentations between scenes; also between clips when that serves the ad |
| 3D | `@remotion/three` kit (device, orbiting logo). Heavy scenes are a Render Job + persistent banner |

If a craft does not fit “drop a clip on V1,” it gets its own useful surface (chat + Player + kit). Do not omit it.

## Rejected

- Refusing a capability because CapCut (or anyone) has it.
- Templates-only as the motion-graphics product.
- Reproducibility-of-pixels as a reason to forbid authored TSX.
- Unsandboxed model TSX in the dashboard origin or the render worker.
- Making the operator keyframe in an After Effects clone in order to get an ad.
- Agent-written GLSL shaders (use Skia/kit primitives; new shader surface needs its own ADR).

## Consequences

- Wave **2M** implementation: compiler, iframe Player, motion kit, tools (children of #1180).
- Overlay-library “no Lottie / no agent TSX” is **lifted** for composition source and licensed Lottie assets.
- Agents must not cite “we’d look like CapCut” as a design constraint ([empower-studio-agent](../../.cursor/rules/empower-studio-agent.mdc)).
