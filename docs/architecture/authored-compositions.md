# Agent-authored Remotion compositions

Contract: [ADR-0091](../adr/0091-empowered-agent-authored-compositions.md).  
Epic: [#1180](https://github.com/Hepteract-Group/marketing-os/issues/1180).  
UX: [authored-composition-flow.md](../ux/authored-composition-flow.md).  
UI: [authored-composition-player.md](../ui/authored-composition-player.md).

## Why

First-party presets assemble footage and Path C chrome. They are not a motion-graphics studio. Advertisers need kinetic type, stingers, 3D device shots, audio-reactive captions, and custom transitions. The Studio Agent authors that as **composition source** on the Studio Project. Operators direct in chat. They do not hire a motion designer and they do not keyframe an NLE.

## Three rooms

```
Studio Agent  --write/patch TSX-->  Studio Project (compositionSource, motionSeed)
                                         |
                                    Compiler (allowlist webpack, no env)
                                         |
                    +--------------------+--------------------+
                    |                                         |
            Isolated Player iframe                    Render Chromium
            (preview)                                 (MP4 / stills)
                    |                                         |
                    +-------- inputProps: signed URLs, brand, seed --------+

Node worker (secrets) stays outside Chromium. It signs URLs and starts the renderer.
```

Hostile TSX from prompt injection must not read Azure / Supabase / Postiz secrets or the operator session. Details: [auth-and-security.md](./auth-and-security.md#authored-compositions).

## Schema (target)

On the Studio Project (still the source of truth — [ADR-0003](../adr/0003-project-json-source-of-truth.md)), field **`compositionSource`**:

```ts
type CompositionSource = {
  /** Remotion TSX module body. Compiled in the sandbox. */
  source: string
  /** Deterministic PRNG seed for Remotion `random()`. */
  motionSeed: string
  /** Compiler revision; bump on successful compile. */
  compiledAtRevision?: number
  /** Last compile error, plain English. Null when green. */
  compileError?: string | null
  /** Dialect + layout for this take. Omitted on empty drafts. */
  artDirection?: {
    dialect: 'snappy' | 'luxury' | 'editorial' | 'comic' | 'brutalist' | 'kinetic-stack'
    layout: 'full-bleed-type' | 'split-stat' | 'stacked-proof' | 'device-hero' | 'stinger-open'
  }
}
```

`compositionId` is a first-party preset **or** `authored`. Unknown first-party ids still reject. Authored source compiles or the Player shows the compile banner — never a silent blank.

Clips, overlays, brand, and assets remain. Authored trees read them as `inputProps` (signed URLs, brand tokens, catalog stats, music energy). Path C chrome wraps the tree so logo and claims cannot be skipped.

## Motion kit

Player iframe + compiler resolve **only** these specifiers (must stay in lockstep):

| Import | Role |
|---|---|
| `remotion` | Frame clock, interpolate, spring, Sequence, Img/Video/Audio, `random` |
| `react` / `react/jsx-runtime` | JSX |
| `@synawood/creative/motion-kit` | First-party ads API (`KineticType`, `CountUp`, `LottieStinger`, …) |

Do **not** prefix-match `@remotion/*`. `@remotion/motion-kit` is not a package — it compiles only if the allowlist is a wildcard, then the Player throws the blocked-library banner.

Planned for the same require map (#1184): `@remotion/transitions`, `@remotion/lottie`, `@remotion/three`, `@remotion/captions`, `@remotion/media-utils`, `@remotion/shapes`, `@remotion/paths`. Until then they fail compile; use the kit (`LottieStinger`, `DeviceFrame`, `SceneWipe`).

Kit components (minimum v1): `KineticType`, `CountUp`, `BrandText`, `LottieStinger`, `DeviceFrame`, `SceneWipe`, `AudioReactiveCaptions`, `fadeIn`, `slideIn`. Prefer kit. Raw `remotion` is still legal when the kit is short.

Forbidden in source: `process`, Node builtins, `eval`, `new Function`, `Worker`, `WebSocket`, `document.cookie`, `Math.random()`.

## Compiler checks

Run on every `write_composition` / `patch_composition`. Fail closed; return a plain-English tool error with the line. The Player banner shows the same sentence. The agent must fix the TSX — do not drop the requested motion.

| Check | How | If they wanted that look |
|---|---|---|
| Import allowlist | Exact specifiers the Player can `require` (`remotion`, `react`, `@synawood/creative/motion-kit`). Not an `@remotion/*` prefix — `@remotion/motion-kit` is not a package. | Use `@synawood/creative/motion-kit` |
| Node / env / eval | Identifier scan: `process`, `fs`, `child_process`, `eval`, `new Function`, `WebSocket`, `document.cookie` | — |
| `Math.random()` | AST / regex on `Math.random` | Remotion `random(\`${motionSeed}-…\`)` |
| CSS time-based motion | Reject `transition:` / `animation:` / `@keyframes` in style objects, template CSS, and styled strings | Kit `fadeIn` / `slideIn` / `spring` driven by `useCurrentFrame` |

Do **not** silently strip CSS transitions. Compile fails with: “CSS transitions flicker on encode. Use `interpolate` / `spring` (or kit `fadeIn`). Same look, tied to the frame.” The agent rewrites. Encode never runs wall-clock CSS.

## Tools

| Tool | Job |
|---|---|
| `list_motion_kit` | Names, props, examples — no spend |
| `write_composition` | Replace `compositionSource` (sets `compositionId` to `authored` if needed). Persists `artDirection.beatLayout` from `creativeStructure` beats (#1201). |
| `patch_composition` | Search/replace or structured patch; compiler runs after |
| `set_motion_seed` | New take of the same formula |
| `inspect_preview` | Required on make-ad turns (ADR-0051) — watches the **compiled** Player. Authored cannot skip: `cutReviewRequired` is true even when the MAIN picture window is 0. Mechanical checks run before vision: motion (type moves; not a fade/Ken Burns poster), hierarchy (split-stat needs CountUp), variety (fingerprint vs recent Finals, sequel exempt), brand (logo or BrandText/Path C), picture (source not empty), claims (BrandText / CountUp vs Catalog/DNA, not only `overlays[]`). Fail `ok:false` with a sentence the agent can patch. Analyze-on-index does not stamp this pass (ADR-0053). `asset_analyses` highlight/segment rows map to a `MotionScenePlan` the agent turns into Sequences (#1200) — still call `inspect_preview` after compose. |
| existing `generate_*` / place / `render_export` | Assets and encode |

Compile failures return as tool errors with the compiler line. The agent fixes the TSX. Do not silently fall back to `talking-head-60` on a motion brief.

## Preview and export

- **Preview:** isolated iframe Player. Parent posts `inputProps`. Same tree as export.
- **Audio:** music beds live on `track_audio`; spoken voiceover on `track_sfx` from frame 0 so speech overlaps the picture. Parent-origin `<audio>` follows the Player clock (`authoredAudioClock`). Do not append VO after the bed on the same exclusive lane.
- **Duration:** authored `autoFitDuration` follows Sequence coverage and Intent length — not stacked audio clips past the picture.
- **Export:** worker bundles authored source with the **same** isolated webpack (no secrets), then `@remotion/renderer`. Chromium request intercept: project asset hosts only.
- Never encode inside the chat request ([render-pipeline.md](./render-pipeline.md)).
- Heavy 3D: Render Job + persistent banner. Preview may use a lighter stand-in only if the banner says export will differ — default is same tree.

## Seeding

`random(\`${motionSeed}-${name}-${frame}\`)` is the only chance allowed. Same project + export twice → identical frames. Operator/agent changes `motionSeed` for a new take. Unseeded `Math.random()` is a compile fail.

## Claim scan and brand

- Path C wrap is not optional.
- `BrandText` / kit text nodes feed claim scan (ADR-0042) the same as `overlays[].text`.
- Catalog numbers in `CountUp` must come from props bound to Catalog / DNA, not invented in the TSX.
- `inspect_preview` claim-scans kit text (`BrandText`, `KineticType`, `CountUp` labels) the same way as overlay copy.

## Implementation slices (epic children, not this docs PR)

1. Isolated compiler + allowlist + fail-closed banner
2. Iframe Player for `compositionId === 'authored'`
3. Motion kit v1 + `list_motion_kit`
4. `write_composition` / `patch_composition` / `set_motion_seed`
5. Renderer network allowlist + seed persistence
6. Lottie library items + 3D device + audio-reactive captions as kit growth
