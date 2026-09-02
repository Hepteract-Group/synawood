import type { StudioProject } from '../project/schema'
import { studioProjectSchema } from '../project/schema'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'
import { getStylePack } from './packs'
import { getTreatment, isTreatmentId, listTreatments } from './treatments'

export const applyStylePackToProject = (
  project: StudioProject,
  stylePackId: string | null,
): StudioProject => {
  if (stylePackId && !getStylePack(stylePackId)) {
    throw new Error(
      `Unknown style pack: ${stylePackId}. Use list_style_packs for first-party ids, or pass null to clear.`,
    )
  }
  return studioProjectSchema.parse({
    ...project,
    stylePackId,
    revision: project.revision + 1,
  })
}

export const applyFilterToClip = (
  project: StudioProject,
  input: { clipId: string; filterId: string | null; intensity?: number },
): StudioProject => {
  const clip = project.clips.find((item) => item.id === input.clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${input.clipId}`)
  }
  if (input.filterId && !getStylePack(input.filterId)) {
    throw new Error(
      `Unknown filter: ${input.filterId}. Use list_style_packs for first-party ids, or pass null to clear.`,
    )
  }
  const intensity = input.intensity ?? 1
  if (intensity < 0 || intensity > 1) {
    throw new Error('filterIntensity must be between 0 and 1')
  }
  return studioProjectSchema.parse({
    ...project,
    clips: project.clips.map((item) =>
      item.id === input.clipId
        ? {
            ...item,
            filterId: input.filterId,
            filterIntensity: input.filterId ? intensity : undefined,
          }
        : item,
    ),
    revision: project.revision + 1,
  })
}

export const applyEffectToClip = (
  project: StudioProject,
  input: { clipId: string; effectId: string; intensity?: number },
): StudioProject => {
  const clip = project.clips.find((item) => item.id === input.clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${input.clipId}`)
  }
  if (!isTreatmentId(input.effectId)) {
    throw new Error(`Unknown treatment: ${input.effectId}. Use shake, glow, flash, or zoom_punch.`)
  }
  const intensity = input.intensity ?? 1
  if (intensity < 0 || intensity > 1) {
    throw new Error('treatment intensity must be between 0 and 1')
  }
  const rest = (clip.treatments ?? []).filter((item) => item.id !== input.effectId)
  return studioProjectSchema.parse({
    ...project,
    clips: project.clips.map((item) =>
      item.id === input.clipId
        ? { ...item, treatments: [...rest, { id: input.effectId, intensity }] }
        : item,
    ),
    revision: project.revision + 1,
  })
}

export const clearEffectFromClip = (
  project: StudioProject,
  input: { clipId: string; effectId: string },
): StudioProject => {
  const clip = project.clips.find((item) => item.id === input.clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${input.clipId}`)
  }
  return studioProjectSchema.parse({
    ...project,
    clips: project.clips.map((item) =>
      item.id === input.clipId
        ? {
            ...item,
            treatments: (item.treatments ?? []).filter((entry) => entry.id !== input.effectId),
          }
        : item,
    ),
    revision: project.revision + 1,
  })
}

export const nextTreatmentIntensity = (current: number): number => {
  if (current < 0.5) return 0.7
  if (current < 0.85) return 1
  return 0.4
}

export const regenEffect = (
  project: StudioProject,
  input: { clipId: string; effectId?: string },
): StudioProject => {
  const clip = project.clips.find((item) => item.id === input.clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${input.clipId}`)
  }
  const treatments = clip.treatments ?? []
  const effectId = input.effectId ?? treatments.at(-1)?.id
  if (!effectId) {
    throw new Error('Nothing to regenerate on this clip')
  }
  const existing = treatments.find((item) => item.id === effectId)
  if (!existing) {
    throw new Error('That treatment is not on this clip')
  }
  const intensity = nextTreatmentIntensity(existing.intensity)
  const next = applyEffectToClip(project, { clipId: input.clipId, effectId, intensity })
  const label = getTreatment(effectId)?.label ?? effectId
  return appendWhyLog(next, {
    t: secondsAtFrame(next, clip.from),
    target: clip.id,
    action: 'effect',
    reason: `Tried ${label} again.`,
  })
}

export const resolveRegenEffectId = (
  reason: string,
  treatments: ReadonlyArray<{ id: string }>,
): string | undefined => {
  const labeled = listTreatments().find((item) => reason.includes(item.label))
  if (labeled && treatments.some((item) => item.id === labeled.id)) return labeled.id
  if (treatments.length === 1) return treatments[0]!.id
  return treatments.at(-1)?.id
}
