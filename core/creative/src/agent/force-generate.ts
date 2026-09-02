import { isMakeVideoRequest } from '../critic/inspect-preview'
import { isMotionGraphicsTurn } from './motion-brief'
import type { GenerationPlanStatus } from '../generation-plan/schema'
import { PLAN_CONFIRMED_GENERATE_MESSAGE } from './plan-confirmed-message'
import { turnModeAllowsGenerate, type TurnMode } from './turn-mode'

export { PLAN_CONFIRMED_GENERATE_MESSAGE } from './plan-confirmed-message'

/** Chat bubble when a make-an-ad turn never called generate (ADR-0055). */
export const MISSING_GENERATE_MESSAGE =
  'Nothing was generated. This reasoner did not call tools, so no clip was created. Switch Reasoner (GPT or Gemini) and ask again — or retry this one.'

/** Chat bubble when a music request never called generate_music (ADR-0088). */
export const MISSING_MUSIC_MESSAGE =
  'No music was generated. This reasoner did not call tools, so the audio track is unchanged. Switch Reasoner (GPT or Gemini) and ask again — or retry this one.'

/** Chat bubble when a VO request never called generate_voiceover. */
export const MISSING_VOICEOVER_MESSAGE =
  'No voiceover was generated. This reasoner did not call tools, so you will not hear a spoken track. Switch Reasoner (GPT or Gemini) and ask again — or retry this one.'

export type ForcedGenerateTool = 'generate_video_clip' | 'generate_music' | 'generate_voiceover'

export const forcedFirstGenerateTool = (input: {
  forceVideo: boolean
  forceMusic: boolean
  forceVoiceover?: boolean
}): ForcedGenerateTool | null => {
  if (input.forceVideo) return 'generate_video_clip'
  if (input.forceVoiceover) return 'generate_voiceover'
  if (input.forceMusic) return 'generate_music'
  return null
}

export const shouldForceVideoGenerate = (input: {
  userMessage: string
  videoToolEnabled: boolean
  remainingBriefSeconds: number | null
  compositionId?: string | null
  turnMode?: TurnMode
}): boolean =>
  turnModeAllowsGenerate(input.turnMode ?? 'execute') &&
  input.videoToolEnabled &&
  isMakeVideoRequest(input.userMessage) &&
  !isMotionGraphicsTurn({
    userMessage: input.userMessage,
    compositionId: input.compositionId,
  }) &&
  (input.remainingBriefSeconds ?? 0) >= 1

/**
 * True when a confirmed Generation Plan (status 'ready') must be executed this turn.
 * Fires instead of (or alongside) shouldForceVideoGenerate for the post-confirm generate turn.
 * ADR-0086 amends ADR-0055: after Apply, generate_video_clip is still required.
 */
export const shouldForceGenerateFromPlan = (input: {
  planStatus: GenerationPlanStatus | undefined
  videoToolEnabled: boolean
  confirmSpend: boolean
}): boolean => input.confirmSpend && input.videoToolEnabled && input.planStatus === 'ready'

export const turnCalledGenerateVideo = (toolNames: string[]): boolean =>
  toolNames.includes('generate_video_clip')

/**
 * True when the agent drafted or updated the generation plan this turn.
 * Suppresses MISSING_GENERATE_MESSAGE — drafting a plan is the valid first step
 * of the plan-first flow (ADR-0086). The post-confirm turn must still generate.
 */
export const turnCalledDraftPlan = (toolNames: string[]): boolean =>
  toolNames.includes('draft_generation_plan') || toolNames.includes('update_generation_plan')

export const isMusicRequest = (userMessage: string): boolean =>
  /background music|music bed|\badd music\b|generate music|\borchestra(?:l)? music\b|instrumental bed|\bsoundtrack\b/i.test(
    userMessage,
  )

/** Existing bed is not enough — they asked to replace or speed it up. */
export const isMusicChangeRequest = (userMessage: string): boolean =>
  /change.{0,80}(?:background )?music|replace.{0,40}(?:music|bed)|new (?:music|bed)|faster.{0,30}(?:tempo|bpm|music|bed)|(?:background music|music bed|the music).{0,80}too slow|too slow.{0,80}(?:background music|music bed|the music)/i.test(
    userMessage,
  )

export const shouldForceMusicGenerate = (input: {
  userMessage: string
  musicToolEnabled: boolean
  hasMusicBed: boolean
  turnMode?: TurnMode
}): boolean =>
  turnModeAllowsGenerate(input.turnMode ?? 'execute') &&
  input.musicToolEnabled &&
  isMusicRequest(input.userMessage) &&
  (!input.hasMusicBed || isMusicChangeRequest(input.userMessage))

export const turnCalledGenerateMusic = (toolNames: string[]): boolean =>
  toolNames.includes('generate_music')

export const isVoiceoverRequest = (userMessage: string): boolean =>
  /voice\s*-?over|\bvoiceover\b|\badd (?:the )?vo\b|\bwarm[- ]female\b|\bnarrat(?:e|ion)\b|\bspeak(?:ing)? (?:track|the ad|over)\b/i.test(
    userMessage,
  )

export const shouldForceVoiceoverGenerate = (input: {
  userMessage: string
  voiceoverToolEnabled: boolean
  hasVoiceover: boolean
  turnMode?: TurnMode
}): boolean =>
  turnModeAllowsGenerate(input.turnMode ?? 'execute') &&
  input.voiceoverToolEnabled &&
  isVoiceoverRequest(input.userMessage) &&
  !input.hasVoiceover

export const turnCalledGenerateVoiceover = (toolNames: string[]): boolean =>
  toolNames.includes('generate_voiceover')

/**
 * True when a generate turn did not call the required tool and the MISSING_ bubble must fire.
 * planForce turns always require generate_video_clip, even if the agent drafted a plan.
 * On normal make-video turns, plan drafting is a valid first step and suppresses the bubble.
 */
export const isMissingGenerate = (input: {
  forceGenerate: boolean
  calledGenerate: boolean
  planForce: boolean
  draftedPlanThisTurn: boolean
}): boolean =>
  input.forceGenerate && !input.calledGenerate && (input.planForce || !input.draftedPlanThisTurn)
