# Contextual clip suggestions

See [ADR-0029](../adr/0029-ai-director-and-contextual-suggestions.md).

**Operator runbook:** [Intent, Scenes, and AI Director](../../core/runbooks/intent-scenes-director.md).

## Purpose

Click a clip (or a scene) → get an executable, brand-aware list of concrete edits. One-tap Apply. This is the vision's "contextual timeline" — clicking a clip does not open a properties inspector; it opens *what could be different about this clip*.

## Tools

```ts
type Suggestion = {
  id: string
  label: string                    // "Shorten to 3s"
  previewText?: string             // "trims 1.8s from the end where speech drops"
  kind: 'trim' | 'zoom' | 'caption' | 'brand' | 'broll' | 'copy' | 'audio' | 'replace' | 'reorder'
  tool: string                     // Studio Tool to call on Apply
  args: unknown                    // schema-validated by the target tool
  estimatedCostGbp: number         // 0 for heuristic suggestions
  requiresGenerator?: boolean      // true → runs as Generation Job
}

suggest_for_clip(clipId: string, opts?: { max?: number }): Suggestion[]
suggest_for_scene(sceneId: string, opts?: { max?: number }): Suggestion[]
```

## Source of suggestions

Two-layer merge:

1. **Heuristic layer** — pure functions over the project + probe data + asset intelligence (Wave 2C asset intelligence). Free. Examples:
   - clip length > median + 2σ → "Shorten to median"
   - no captions on a video clip with a transcript → "Add captions"
   - clip crosses scene boundary → "Split at scene boundary"
   - brand kit attached but overlay doesn't use brand colour → "Match brand"
   - `asset_tags` include `face` and framing is wide → "Zoom on face"
   - similar assets in library (from `find_assets` on the clip's caption) → "Try alternate take"

2. **Reasoner layer** — a small `suggest_for_clip` reasoner call with a compact clip context (probe, tags, transcript excerpt, scene role) and the curated *editor-cuts* / *copywriter-hooks* skill packs. Produces 3–5 higher-level ideas. Cached per (clipId, projectRevision).

Suggestions are merged, deduplicated by `tool + args` hash, sorted by expected impact (heuristic priors + skill-pack priority).

## Executable, not narrative

Every `Suggestion` must carry `tool` + `args` valid against that tool's schema. UI "Apply" dispatches through the same `applyProjectMutation` path as chat / DnD / Director. If the target tool is a `generate_*`, Apply enqueues a Generation Job and the drawer row switches to a progress state.

## Cost policy

- `estimatedCostGbp = 0` suggestions are one-tap Apply.
- Any suggestion with `requiresGenerator: true` and `estimatedCostGbp > 0` shows the estimate inline and requires a confirm click.
- Bulk-apply (checkbox multiple suggestions) sums estimates and shows a single confirm.

## Caching

- Heuristic layer runs on every open (fast, no cache needed).
- Reasoner layer caches per `(clipId, revision, skillPackVersion)` — same rules as Director. Explicit "Refresh" ignores cache.

## Failure modes

- Suggestion carries invalid `args` (schema drift) → row shows "Unavailable" with reason; other rows unaffected.
- Applied `generate_*` fails → drawer row switches to failed state, expand auto-shows tool trace excerpt (ADR-0018).
- Suggestions computed against a stale revision → whole drawer marks stale; "Refresh" re-computes.

## Relationship to Director

- Director changes **many things across scope**. Contextual is **one clip at a time**.
- A cluster of contextual suggestions can be "promoted" to a Director plan ("Apply all + rebalance") — implemented as a helper that packages them into a `DirectorPlan` shell for preview.
