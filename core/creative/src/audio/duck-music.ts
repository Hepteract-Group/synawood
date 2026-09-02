import { isSpeechAudioAsset } from '../project/picture-completeness'
import {
  studioProjectSchema,
  type ProjectAsset,
  type ProjectClip,
  type StudioProject,
} from '../project/schema'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'

/** Music gain under speech (~−15 dB). Deterministic — no model. */
export const SPEECH_DUCK_GAIN = 0.18
export const MUSIC_REST_GAIN = 1
export const DUCK_ATTACK_FRAMES = 6
export const DUCK_RELEASE_FRAMES = 10

export type VolumeKeyframe = { atFrame: number; gain: number }

export type TimelineWindow = { startFrame: number; endFrame: number }

export type DuckMusicPlan =
  | { ok: false; error: string }
  | {
      ok: true
      skip: true
      reason: string
      clipIds: string[]
    }
  | {
      ok: true
      skip: false
      envelopes: Map<string, VolumeKeyframe[]>
      clipIds: string[]
    }

const isSfxAsset = (asset: ProjectAsset | undefined): boolean =>
  Boolean(asset && asset.kind === 'audio' && asset.probe?.role === 'sfx')

const isMusicAsset = (asset: ProjectAsset | undefined): boolean => {
  if (!asset || asset.kind !== 'audio') return false
  if (isSfxAsset(asset) || isSpeechAudioAsset(asset)) return false
  const role = asset.probe?.role
  if (role === 'music_bed') return true
  return role == null
}

const isSpeechAsset = (asset: ProjectAsset | undefined): boolean => {
  if (!asset) return false
  if (asset.kind === 'video') return true
  return isSpeechAudioAsset(asset)
}

const transcriptWindowsForClip = (
  project: StudioProject,
  clip: ProjectClip,
  asset: ProjectAsset,
): TimelineWindow[] => {
  const fps = project.fps > 0 ? project.fps : 30
  const trimStart = clip.trim.startFrames ?? 0
  const raw = asset.probe?.transcriptSegments
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ startFrame: clip.from, endFrame: clip.from + clip.durationInFrames }]
  }
  const windows: TimelineWindow[] = []
  for (const row of raw) {
    const record = row as { startMs?: unknown; endMs?: unknown; text?: unknown }
    const text = String(record.text ?? '').trim()
    if (!text) continue
    const startMs = Number(record.startMs) || 0
    const endMs = Number(record.endMs) || 0
    if (endMs <= startMs) continue
    const localStart = Math.round((startMs / 1000) * fps) - trimStart
    const localEnd = Math.round((endMs / 1000) * fps) - trimStart
    const startFrame = clip.from + Math.max(0, localStart)
    const endFrame = clip.from + Math.min(clip.durationInFrames, Math.max(localStart + 1, localEnd))
    if (endFrame > startFrame) windows.push({ startFrame, endFrame })
  }
  return windows
}

export const mergeWindows = (windows: TimelineWindow[]): TimelineWindow[] => {
  if (windows.length === 0) return []
  const sorted = [...windows].sort((a, b) => a.startFrame - b.startFrame)
  const merged: TimelineWindow[] = [{ ...sorted[0]! }]
  for (const next of sorted.slice(1)) {
    const last = merged[merged.length - 1]!
    if (next.startFrame <= last.endFrame) {
      last.endFrame = Math.max(last.endFrame, next.endFrame)
    } else {
      merged.push({ ...next })
    }
  }
  return merged
}

export const speechWindowsFromProject = (project: StudioProject): TimelineWindow[] => {
  const windows: TimelineWindow[] = []
  for (const clip of project.clips) {
    const asset = project.assets.find((item) => item.id === clip.assetId)
    if (!isSpeechAsset(asset) || !asset) continue
    windows.push(...transcriptWindowsForClip(project, clip, asset))
  }
  return mergeWindows(windows)
}

export const musicClipsInProject = (project: StudioProject, clipId?: string): ProjectClip[] => {
  const clips = project.clips.filter((clip) => {
    const asset = project.assets.find((item) => item.id === clip.assetId)
    return isMusicAsset(asset)
  })
  if (!clipId) return clips
  const match = clips.find((clip) => clip.id === clipId)
  return match ? [match] : []
}

const envelopesEqual = (a: VolumeKeyframe[] | undefined, b: VolumeKeyframe[]): boolean => {
  if (!a || a.length !== b.length) return false
  return a.every((key, index) => key.atFrame === b[index]?.atFrame && key.gain === b[index]?.gain)
}

const pushKey = (keys: VolumeKeyframe[], atFrame: number, gain: number, duration: number) => {
  const frame = Math.max(0, Math.min(duration, Math.round(atFrame)))
  const last = keys[keys.length - 1]
  if (last && last.atFrame === frame) {
    last.gain = gain
    return
  }
  if (last && frame < last.atFrame) return
  keys.push({ atFrame: frame, gain })
}

export const envelopeForMusicClip = (
  clip: ProjectClip,
  speech: TimelineWindow[],
): VolumeKeyframe[] => {
  const duration = clip.durationInFrames
  const keys: VolumeKeyframe[] = []
  pushKey(keys, 0, MUSIC_REST_GAIN, duration)

  for (const window of speech) {
    const localStart = window.startFrame - clip.from
    const localEnd = window.endFrame - clip.from
    if (localEnd <= 0 || localStart >= duration) continue
    const duckStart = Math.max(0, localStart)
    const duckEnd = Math.min(duration, localEnd)
    if (duckEnd <= duckStart) continue
    pushKey(keys, duckStart - DUCK_ATTACK_FRAMES, MUSIC_REST_GAIN, duration)
    pushKey(keys, duckStart, SPEECH_DUCK_GAIN, duration)
    pushKey(keys, duckEnd, SPEECH_DUCK_GAIN, duration)
    pushKey(keys, duckEnd + DUCK_RELEASE_FRAMES, MUSIC_REST_GAIN, duration)
  }

  pushKey(keys, duration, keys[keys.length - 1]?.gain ?? MUSIC_REST_GAIN, duration)
  return keys
}

export const gainAtEnvelope = (envelope: VolumeKeyframe[] | undefined, frame: number): number => {
  if (!envelope || envelope.length === 0) return MUSIC_REST_GAIN
  if (frame <= envelope[0]!.atFrame) return envelope[0]!.gain
  const last = envelope[envelope.length - 1]!
  if (frame >= last.atFrame) return last.gain
  for (let index = 1; index < envelope.length; index += 1) {
    const next = envelope[index]!
    const prev = envelope[index - 1]!
    if (frame <= next.atFrame) {
      const span = Math.max(1, next.atFrame - prev.atFrame)
      const t = (frame - prev.atFrame) / span
      return prev.gain + (next.gain - prev.gain) * t
    }
  }
  return MUSIC_REST_GAIN
}

export const planDuckMusic = (
  project: StudioProject,
  input: { clipId?: string } = {},
): DuckMusicPlan => {
  const music = musicClipsInProject(project, input.clipId)
  if (input.clipId && music.length === 0) {
    return { ok: false, error: 'Select a music bed clip to duck.' }
  }
  if (music.length === 0) {
    return { ok: false, error: 'Add a music bed first, then duck it under speech.' }
  }
  const speech = speechWindowsFromProject(project)
  if (speech.length === 0) {
    return {
      ok: false,
      error:
        'Add voiceover speech (or a talking-head take) so ducking has something to follow. On motion ads, call generate_voiceover first.',
    }
  }

  const envelopes = new Map<string, VolumeKeyframe[]>()
  for (const clip of music) {
    envelopes.set(clip.id, envelopeForMusicClip(clip, speech))
  }

  const already = music.every((clip) =>
    envelopesEqual(clip.volumeEnvelope, envelopes.get(clip.id)!),
  )
  if (already) {
    return {
      ok: true,
      skip: true,
      reason: 'Music already ducks under speech — skipped.',
      clipIds: music.map((clip) => clip.id),
    }
  }

  return {
    ok: true,
    skip: false,
    envelopes,
    clipIds: music.map((clip) => clip.id),
  }
}

export const applyDuckMusic = (
  project: StudioProject,
  input: { clipId?: string } = {},
): StudioProject => {
  const plan = planDuckMusic(project, input)
  if (!plan.ok) throw new Error(plan.error)
  if (plan.skip) return project
  const ducked = studioProjectSchema.parse({
    ...project,
    clips: project.clips.map((clip) => {
      const envelope = plan.envelopes.get(clip.id)
      return envelope ? { ...clip, volumeEnvelope: envelope } : clip
    }),
    revision: project.revision + 1,
  })
  const firstSpeech = speechWindowsFromProject(project)[0]
  return appendWhyLog(ducked, {
    t: firstSpeech ? secondsAtFrame(project, firstSpeech.startFrame) : 0,
    target: plan.clipIds[0] ?? 'cut',
    action: 'duck',
    reason: 'Ducked music under speech.',
  })
}
