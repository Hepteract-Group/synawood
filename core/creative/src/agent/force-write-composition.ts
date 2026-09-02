import { type CompositionId } from '../project/schema'
import {
  classifyTurnJob,
  forcedToolsForJob,
  isExtractRequest,
  isPaceOrTypeChangeRequest,
} from './turn-job'
import { turnModeAllowsGenerate, type TurnMode } from './turn-mode'

export { isPaceOrTypeChangeRequest } from './turn-job'

/** Chat bubble when Execute on a broken authored player never called write/patch. */
export const MISSING_WRITE_COMPOSITION_MESSAGE =
  'Nothing was written to the Player. This reasoner did not call write_composition or patch_composition, so the picture is unchanged. Switch Reasoner (GPT or Gemini) and ask again — or retry this one.'

/**
 * Force write only for empty source or an explicit picture.write job.
 * Leftover inspect-fail alone must not steal an audio / patch turn.
 */
export const shouldForceWriteComposition = (input: {
  turnMode?: TurnMode
  compositionId?: CompositionId | string | null
  sourceChars?: number
  cutReviewPassed?: boolean | null
  userMessage?: string
}): boolean => {
  if (!turnModeAllowsGenerate(input.turnMode ?? 'execute')) return false
  if (input.compositionId !== 'authored') return false
  if (input.userMessage && isExtractRequest(input.userMessage)) return false
  const empty = (input.sourceChars ?? 0) < 40
  if (empty) return true
  if (!input.userMessage) return false
  const job = classifyTurnJob({
    userMessage: input.userMessage,
    compositionId: input.compositionId,
    sourceChars: input.sourceChars,
    cutReviewPassed: input.cutReviewPassed,
  })
  return job === 'picture.write'
}

export const turnCalledWriteComposition = (toolNames: string[]): boolean =>
  toolNames.includes('write_composition') || toolNames.includes('patch_composition')

export const shouldForcePatchComposition = (input: {
  turnMode?: TurnMode
  compositionId?: CompositionId | string | null
  sourceChars?: number
  userMessage: string
  cutReviewPassed?: boolean | null
}): boolean => {
  if (!turnModeAllowsGenerate(input.turnMode ?? 'execute')) return false
  if (input.compositionId !== 'authored') return false
  if (isExtractRequest(input.userMessage)) return false
  if ((input.sourceChars ?? 0) < 40) return false
  const job = classifyTurnJob({
    userMessage: input.userMessage,
    compositionId: input.compositionId,
    sourceChars: input.sourceChars,
    cutReviewPassed: input.cutReviewPassed,
  })
  return job === 'picture.patch' || job === 'picture.bind'
}

export type ForcedStepTool = { type: 'tool'; toolName: string }

const fallbackForcedQueue = (input: {
  forceWrite: boolean
  forcePatch?: boolean
  forceMusic: boolean
  forceVoiceover?: boolean
}): string[] => {
  const queue: string[] = []
  if (input.forceWrite) queue.push('write_composition')
  else if (input.forcePatch) queue.push('patch_composition')
  if (input.forceVoiceover) queue.push('generate_voiceover')
  if (input.forceMusic) queue.push('generate_music')
  if (input.forceWrite || input.forcePatch || input.forceVoiceover || input.forceMusic) {
    queue.push('inspect_preview')
  }
  return queue
}

/** Job-scoped force queue — leftover inspect debt never replaces the operator job. */
export const forcedToolForStep = (input: {
  stepNumber: number
  forceWrite: boolean
  forcePatch?: boolean
  forceMusic: boolean
  forceVoiceover?: boolean
  forcedFirstTool: string | null
  job?: ReturnType<typeof classifyTurnJob>
}): ForcedStepTool | 'auto' => {
  const queue = input.job
    ? forcedToolsForJob(input.job, {
        forceWrite: input.forceWrite,
        forcePatch: input.forcePatch,
        forceMusic: input.forceMusic,
        forceVoiceover: input.forceVoiceover,
      })
    : fallbackForcedQueue(input)
  const name = queue[input.stepNumber]
  if (name) return { type: 'tool', toolName: name }
  if (!queue.length && input.forcedFirstTool && input.stepNumber === 0) {
    return { type: 'tool', toolName: input.forcedFirstTool }
  }
  return 'auto'
}
