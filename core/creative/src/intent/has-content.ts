import type { Intent } from './schema'

export const intentHasContent = (intent: Intent): boolean => {
  const audience = intent.audience
  const audienceSet = Boolean(
    audience &&
    (audience.persona ||
      audience.context ||
      audience.ageRange ||
      audience.awarenessStage ||
      audience.language ||
      audience.primaryPain),
  )
  return Boolean(
    intent.goal ||
    intent.goalNote ||
    intent.funnelStage ||
    intent.kpi ||
    intent.desiredBehaviour ||
    intent.platform ||
    intent.emotion ||
    intent.lengthSeconds != null ||
    intent.cta ||
    intent.primaryMessage ||
    (intent.supportingPoints && intent.supportingPoints.length > 0) ||
    intent.brandVoice ||
    audienceSet ||
    (intent.keywords && intent.keywords.length > 0),
  )
}
