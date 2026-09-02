import { createHash } from 'node:crypto'
import { suggestionSchema, type Suggestion } from '../intent/schema'
import type { StudioProject } from '../project/schema'
import { videoTrackHasPackableGaps } from '../project/operations'

const hashArgs = (tool: string, args: Record<string, unknown>): string =>
  createHash('sha256').update(JSON.stringify({ tool, args })).digest('hex').slice(0, 12)

const suggestion = (
  partial: Omit<Suggestion, 'id' | 'estimatedCostGbp' | 'requiresGenerator' | 'args'> & {
    args?: Record<string, unknown>
    estimatedCostGbp?: number
    requiresGenerator?: boolean
    id?: string
  },
): Suggestion => {
  const args = partial.args ?? {}
  return suggestionSchema.parse({
    id: partial.id ?? `sg_${hashArgs(partial.tool, args)}`,
    label: partial.label,
    previewText: partial.previewText,
    kind: partial.kind,
    tool: partial.tool,
    args,
    estimatedCostGbp: partial.estimatedCostGbp ?? 0,
    requiresGenerator: partial.requiresGenerator ?? false,
  })
}

const clipEnd = (from: number, duration: number) => from + duration

const captionsOverlapClip = (project: StudioProject, clipId: string): boolean => {
  const clip = project.clips.find((c) => c.id === clipId)
  if (!clip) return false
  const start = clip.from
  const end = clipEnd(clip.from, clip.durationInFrames)
  return project.overlays.some((overlay) => {
    if (overlay.kind !== 'caption' && overlay.kind !== 'lower_third') return false
    const oEnd = clipEnd(overlay.from, overlay.durationInFrames)
    return overlay.from < end && oEnd > start
  })
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/** Pure heuristic suggestions for one clip. Free / no generator. */
export const suggestForClipHeuristic = (
  project: StudioProject,
  clipId: string,
  opts: { max?: number } = {},
): Suggestion[] => {
  const max = opts.max ?? 6
  const clip = project.clips.find((c) => c.id === clipId)
  if (!clip) return []

  const asset = project.assets.find((a) => a.id === clip.assetId)
  const out: Suggestion[] = []
  const durations = project.clips.map((c) => c.durationInFrames)
  const med = median(durations)

  if (
    clip.durationInFrames > 45 &&
    (durations.length < 2 || med === 0 || clip.durationInFrames > med * 1.15)
  ) {
    const target = Math.max(
      15,
      Math.floor(
        durations.length < 2 || med === 0
          ? clip.durationInFrames * 0.85
          : Math.min(med, clip.durationInFrames * 0.85),
      ),
    )
    if (target < clip.durationInFrames) {
      const seconds = Math.round((target / project.fps) * 10) / 10
      out.push(
        suggestion({
          label: `Shorten to ${seconds}s`,
          previewText: `Trim from ${Math.round((clip.durationInFrames / project.fps) * 10) / 10}s to ${seconds}s`,
          kind: 'trim',
          tool: 'trim_clip',
          args: { clipId, durationInFrames: target },
        }),
      )
    }
  }

  if (
    (asset?.kind === 'video' || asset?.kind === 'audio') &&
    !captionsOverlapClip(project, clipId)
  ) {
    const cue = project.intent?.cta?.trim() || project.brand?.defaultCta?.trim() || 'Key message'
    out.push(
      suggestion({
        label: 'Add captions',
        previewText: 'Place a caption overlay on this clip',
        kind: 'caption',
        tool: 'add_captions',
        args: { text: cue },
      }),
    )
  }

  const sceneForClip = project.scenes.find((s) => s.clipIds.includes(clipId))

  if (clip.durationInFrames >= 90) {
    const atFrame = clip.from + Math.floor(clip.durationInFrames / 2)
    out.push(
      suggestion({
        label: 'Split at midpoint',
        previewText: `Split at frame ${atFrame}`,
        kind: 'reorder',
        tool: 'split_clip',
        args: { clipId, atFrame },
      }),
    )
  }

  const scene = sceneForClip
  if (!scene && project.scenes.length > 0) {
    const targetScene = project.scenes[0]!
    out.push(
      suggestion({
        label: `Assign to ${targetScene.label || targetScene.role}`,
        previewText: `Put this clip in scene ${targetScene.id}`,
        kind: 'reorder',
        tool: 'assign_clip_to_scene',
        args: { clipId, sceneId: targetScene.id },
      }),
    )
  }

  if (project.clips.length >= 2 && videoTrackHasPackableGaps(project)) {
    out.push(
      suggestion({
        label: 'Pack timeline',
        previewText: 'Close gaps between clips on the video track',
        kind: 'reorder',
        tool: 'pack_clips',
        args: {},
      }),
    )
  }

  return dedupeSuggestions(out).slice(0, max)
}

/** Pure heuristic suggestions for one scene. */
export const suggestForSceneHeuristic = (
  project: StudioProject,
  sceneId: string,
  opts: { max?: number } = {},
): Suggestion[] => {
  const max = opts.max ?? 6
  const scene = project.scenes.find((s) => s.id === sceneId)
  if (!scene) return []

  const out: Suggestion[] = []

  if (scene.clipIds.length >= 2 && videoTrackHasPackableGaps(project)) {
    out.push(
      suggestion({
        label: 'Pack timeline',
        previewText: 'Close gaps so scene clips sit end-to-end',
        kind: 'reorder',
        tool: 'pack_clips',
        args: {},
      }),
    )
  }

  for (const clipId of scene.clipIds.slice(0, 3)) {
    out.push(...suggestForClipHeuristic(project, clipId, { max: 2 }))
  }

  if (!scene.locked && scene.role === 'cta' && project.intent?.cta) {
    out.push(
      suggestion({
        label: 'Set end card CTA',
        previewText: `Use Intent CTA: ${project.intent.cta}`,
        kind: 'copy',
        tool: 'set_end_card',
        args: { text: project.intent.cta },
      }),
    )
  }

  return dedupeSuggestions(out).slice(0, max)
}

export const dedupeSuggestions = (items: Suggestion[]): Suggestion[] => {
  const seen = new Set<string>()
  const out: Suggestion[] = []
  for (const item of items) {
    const key = `${item.tool}:${JSON.stringify(item.args)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export const suggestionCacheKey = (kind: 'clip' | 'scene', id: string, revision: number): string =>
  `${kind}:${id}:r${revision}`
