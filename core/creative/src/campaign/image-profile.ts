/** Resolve generator-capable profiles for campaign packs (#461 / #467). */

import { getModelProfile } from '../model-profiles/registry'

const FALLBACKS = ['ci-stub', 'cheap-draft', 'balanced'] as const

export type CampaignGeneratorRole = 'image' | 'video'

export const resolveCampaignGeneratorProfileId = (
  modelProfileId: string,
  role: CampaignGeneratorRole,
): string => {
  try {
    const profile = getModelProfile(modelProfileId)
    if (profile[role].modelId !== 'disabled') return modelProfileId
  } catch {
    // unknown profile — fall through
  }
  for (const id of FALLBACKS) {
    try {
      const profile = getModelProfile(id)
      if (profile[role].modelId !== 'disabled') return id
    } catch {
      continue
    }
  }
  return modelProfileId
}

export const resolveCampaignImageProfileId = (modelProfileId: string): string =>
  resolveCampaignGeneratorProfileId(modelProfileId, 'image')

export const resolveCampaignVideoProfileId = (modelProfileId: string): string =>
  resolveCampaignGeneratorProfileId(modelProfileId, 'video')

export const campaignGeneratorProfileNote = (
  requested: string,
  resolved: string,
  role: CampaignGeneratorRole,
): string | undefined =>
  requested === resolved
    ? undefined
    : `Profile ${requested} cannot generate ${role}; using ${resolved} for this run.`

export const campaignImageProfileNote = (requested: string, resolved: string): string | undefined =>
  campaignGeneratorProfileNote(requested, resolved, 'image')
