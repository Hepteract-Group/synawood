import type { ProjectAsset, ProjectClip, StudioProject } from '../project/schema'
import { studioProjectSchema } from '../project/schema'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'

export const REFRAME_ASPECTS = ['9:16', '16:9', '1:1', '4:5'] as const
export type ReframeAspect = (typeof REFRAME_ASPECTS)[number]

export const isReframeAspect = (value: string | undefined): value is ReframeAspect =>
  Boolean(value && (REFRAME_ASPECTS as readonly string[]).includes(value))

export type ReframeTrackPoint = {
  t: number
  x: number
  y: number
  w: number
  h: number
}

export type ClipReframe = {
  aspect: ReframeAspect
  tracking: ReframeTrackPoint[]
}

export const REFRAME_STUB_MODEL_ID = 'mock-reframe'

export const isStubReframeModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') ||
  modelId === 'disabled' ||
  modelId.includes('stub') ||
  modelId.includes('ci-')

const aspectRatio = (aspect: ReframeAspect): number => {
  const [width, height] = aspect.split(':').map(Number)
  return (width ?? 9) / (height ?? 16)
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const sourceSize = (asset: ProjectAsset): { width: number; height: number } => {
  const probe = asset.probe ?? {}
  const width = Number(probe.width) || Number(probe.pixelWidth) || 1920
  const height = Number(probe.height) || Number(probe.pixelHeight) || 1080
  return { width: Math.max(1, width), height: Math.max(1, height) }
}

const faceCenter = (
  probe: Record<string, unknown> | undefined,
): { x: number; y: number } | null => {
  const direct = probe?.face
  const listed = Array.isArray(probe?.faces) ? probe.faces[0] : undefined
  const box = (direct && typeof direct === 'object' ? direct : listed) as
    { x?: unknown; y?: unknown; w?: unknown; h?: unknown } | undefined
  if (!box) return null
  const x = Number(box.x)
  const y = Number(box.y)
  const w = Number(box.w)
  const h = Number(box.h)
  if (![x, y, w, h].every(Number.isFinite)) return null
  return { x: clamp01(x + w / 2), y: clamp01(y + h / 2) }
}

/** Center (optionally face-weighted) crop window in 0–1 of the source. */
export const cropWindowForAspect = (
  sourceWidth: number,
  sourceHeight: number,
  aspect: ReframeAspect,
  subject?: { x: number; y: number } | null,
): Omit<ReframeTrackPoint, 't'> => {
  const source = sourceWidth / sourceHeight
  const target = aspectRatio(aspect)
  let x = 0
  let y = 0
  let w = 1
  let h = 1
  if (source > target) {
    w = clamp01(target / source)
    x = (1 - w) / 2
  } else if (source < target) {
    h = clamp01(source / target)
    y = (1 - h) / 2
  }
  if (subject) {
    x = clamp01(subject.x - w / 2)
    y = clamp01(subject.y - h / 2)
    if (x + w > 1) x = 1 - w
    if (y + h > 1) y = 1 - h
  }
  return { x, y, w, h }
}

export const interpolateTracking = (
  tracking: readonly ReframeTrackPoint[],
  timeSeconds: number,
): ReframeTrackPoint => {
  if (tracking.length === 0) {
    return { t: timeSeconds, x: 0, y: 0, w: 1, h: 1 }
  }
  const sorted = [...tracking].sort((a, b) => a.t - b.t)
  const first = sorted[0]!
  const last = sorted.at(-1)!
  if (timeSeconds <= first.t) return first
  if (timeSeconds >= last.t) return last
  const nextIndex = sorted.findIndex((point) => point.t >= timeSeconds)
  const right = sorted[nextIndex]!
  const left = sorted[nextIndex - 1]!
  const span = right.t - left.t
  const mix = span <= 0 ? 0 : (timeSeconds - left.t) / span
  const lerp = (from: number, to: number) => from + (to - from) * mix
  return {
    t: timeSeconds,
    x: lerp(left.x, right.x),
    y: lerp(left.y, right.y),
    w: lerp(left.w, right.w),
    h: lerp(left.h, right.h),
  }
}

/** CSS that maps a 0–1 source crop onto a filled frame (pan/scan). */
export const panScanStyle = (box: Omit<ReframeTrackPoint, 't'>): Record<string, string> => ({
  position: 'absolute',
  width: `${(1 / Math.max(box.w, 0.01)) * 100}%`,
  height: `${(1 / Math.max(box.h, 0.01)) * 100}%`,
  left: `${(-box.x / Math.max(box.w, 0.01)) * 100}%`,
  top: `${(-box.y / Math.max(box.h, 0.01)) * 100}%`,
  objectFit: 'fill',
  maxWidth: 'none',
})

export const stubTrackingFor = (
  asset: ProjectAsset,
  aspect: ReframeAspect,
): ReframeTrackPoint[] => {
  const { width, height } = sourceSize(asset)
  const window = cropWindowForAspect(width, height, aspect, faceCenter(asset.probe))
  return [{ t: 0, ...window }]
}

export type ReframeClipPlan =
  | { ok: false; error: string }
  | {
      ok: true
      skip: true
      clip: ProjectClip
      asset: ProjectAsset
      reason: string
    }
  | {
      ok: true
      skip: false
      clip: ProjectClip
      asset: ProjectAsset
      aspect: ReframeAspect
      reframe: ClipReframe
    }

export const planReframeClip = (
  project: StudioProject,
  input: { clipId?: string; aspect?: string; subjectHint?: string },
): ReframeClipPlan => {
  const aspect = input.aspect ?? '9:16'
  if (!isReframeAspect(aspect)) {
    return { ok: false, error: 'Pick 9:16, 16:9, 1:1, or 4:5.' }
  }
  const clip = input.clipId
    ? project.clips.find((item) => item.id === input.clipId)
    : project.clips.find((item) => {
        const asset = project.assets.find((row) => row.id === item.assetId)
        return asset?.kind === 'video'
      })
  if (!clip) {
    return { ok: false, error: 'Select a talking-head clip to reframe.' }
  }
  const asset = project.assets.find((item) => item.id === clip.assetId)
  if (!asset) {
    return { ok: false, error: 'That clip’s media is missing from this project.' }
  }
  if (asset.kind !== 'video' && asset.kind !== 'image') {
    return { ok: false, error: 'Reframe needs a video or still clip.' }
  }
  if (clip.reframe?.aspect === aspect && (clip.reframe.tracking?.length ?? 0) > 0) {
    return {
      ok: true,
      skip: true,
      clip,
      asset,
      reason: `This take is already framed to ${aspect} — skipped.`,
    }
  }
  const reframe: ClipReframe = { aspect, tracking: stubTrackingFor(asset, aspect) }
  return { ok: true, skip: false, clip, asset, aspect, reframe }
}

export const applyReframeClip = (
  project: StudioProject,
  input: { clipId: string; reframe: ClipReframe },
): StudioProject => {
  const clip = project.clips.find((item) => item.id === input.clipId)
  const next = studioProjectSchema.parse({
    ...project,
    clips: project.clips.map((item) =>
      item.id === input.clipId ? { ...item, reframe: input.reframe } : item,
    ),
  })
  return appendWhyLog(next, {
    t: clip ? secondsAtFrame(project, clip.from) : 0,
    target: input.clipId,
    action: 'reframe',
    reason: `Reframed take to ${input.reframe.aspect}.`,
  })
}
