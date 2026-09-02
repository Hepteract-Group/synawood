import { applyEffectToClip } from './apply'
import type { TreatmentId } from './treatments'
import type { StudioProject } from '../project/schema'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'

export const MOTION_PRESET_IDS = ['hook_punch', 'cta_hit'] as const

export type MotionPresetId = (typeof MOTION_PRESET_IDS)[number]

export type MotionPresetStep = { effectId: TreatmentId; intensity: number }

export type MotionPreset = {
  id: MotionPresetId
  label: string
  hint: string
  steps: readonly MotionPresetStep[]
  why: string
}

export const MOTION_PRESETS: readonly MotionPreset[] = [
  {
    id: 'hook_punch',
    label: 'Hook punch',
    hint: 'Small zoom and flash on the opening beat',
    steps: [
      { effectId: 'zoom_punch', intensity: 0.7 },
      { effectId: 'flash', intensity: 0.35 },
    ],
    why: 'Added a punch on the hook.',
  },
  {
    id: 'cta_hit',
    label: 'Call to action',
    hint: 'Shake and flash on the closing ask',
    steps: [
      { effectId: 'shake', intensity: 0.48 },
      { effectId: 'flash', intensity: 0.4 },
    ],
    why: 'Added a punch on the call to action.',
  },
]

export const isMotionPresetId = (value: string): value is MotionPresetId =>
  (MOTION_PRESET_IDS as readonly string[]).includes(value)

export const getMotionPreset = (id: string): MotionPreset | undefined =>
  MOTION_PRESETS.find((item) => item.id === id)

export const listMotionPresets = (): readonly MotionPreset[] => MOTION_PRESETS

export const applyMotionPreset = (
  project: StudioProject,
  input: { clipId: string; presetId: MotionPresetId },
): StudioProject => {
  const preset = getMotionPreset(input.presetId)
  if (!preset) {
    throw new Error(`Unknown motion pack: ${input.presetId}`)
  }
  const clip = project.clips.find((item) => item.id === input.clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${input.clipId}`)
  }
  const already = preset.steps.every((step) =>
    clip.treatments?.some(
      (treatment) => treatment.id === step.effectId && treatment.intensity === step.intensity,
    ),
  )
  if (already) return project
  let next = project
  for (const step of preset.steps) {
    next = applyEffectToClip(next, {
      clipId: input.clipId,
      effectId: step.effectId,
      intensity: step.intensity,
    })
  }
  return appendWhyLog(next, {
    t: secondsAtFrame(next, clip.from),
    target: clip.id,
    action: 'effect',
    reason: preset.why,
  })
}
