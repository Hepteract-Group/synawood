import { isAuthoredComposition, type CompositionId } from '../project/schema'
import { isMotionGraphicsTurn } from './motion-brief'
import { DEFAULT_MAX_STEPS, MOTION_FIRST_PASS_MAX_STEPS } from './types'

export const resolveTurnMaxSteps = (input: {
  maxSteps?: number
  userMessage: string
  compositionId: CompositionId
}): number => {
  if (typeof input.maxSteps === 'number') return input.maxSteps
  if (
    isAuthoredComposition(input.compositionId) ||
    isMotionGraphicsTurn({ userMessage: input.userMessage, compositionId: input.compositionId })
  ) {
    return MOTION_FIRST_PASS_MAX_STEPS
  }
  return DEFAULT_MAX_STEPS
}
