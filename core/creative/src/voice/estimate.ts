/** Voice Studio cost estimates (ADR-0033 / #224). */

import { estimateGbp } from '../pricing'
import { getModelProfile, resolveModelRef, type GeneratorRole } from '../model-profiles'

export type VoiceEstimateRole = Extract<GeneratorRole, 'voiceSynth' | 'voiceDub' | 'voiceClone'>

export const estimateVoiceJobGbp = (input: {
  modelProfileId: string
  durationSeconds: number
  role: VoiceEstimateRole
}): { modelId: string; units: number; estimatedGbp: number } => {
  const model = resolveModelRef(input.modelProfileId, input.role)
  const units = Math.max(1, Math.ceil(input.durationSeconds))
  return { modelId: model.modelId, units, estimatedGbp: estimateGbp(model.modelId, units) }
}

export const estimateVoiceSynthGbp = (input: { modelProfileId: string; durationSeconds: number }) =>
  estimateVoiceJobGbp({ ...input, role: 'voiceSynth' })

export const estimateVoiceDubGbp = (input: { modelProfileId: string; durationSeconds: number }) =>
  estimateVoiceJobGbp({ ...input, role: 'voiceDub' })

export const estimateVoiceCloneGbp = (input: { modelProfileId: string; durationSeconds: number }) =>
  estimateVoiceJobGbp({ ...input, role: 'voiceClone' })

export const voiceSoftCapGbp = (modelProfileId: string): number =>
  getModelProfile(modelProfileId).limits.perJobSoftCapGbp
