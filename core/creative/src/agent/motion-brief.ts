import { type StudioCraft } from '../project/schema'

/** True when the operator asked for motion graphics, not a talking-head take. */
export const isMotionGraphicsBrief = (text: string): boolean => {
  const trimmed = text.trim().toLowerCase()
  return (
    /kinetic(\s+type)?/.test(trimmed) ||
    /stat\s*slam/.test(trimmed) ||
    /motion\s*graphics/.test(trimmed) ||
    /put (the )?app in a phone/.test(trimmed) ||
    /device\s*frame/.test(trimmed) ||
    /lottie\s*(stinger|ad)/.test(trimmed) ||
    /authored(\s+comp|\s+ad)/.test(trimmed) ||
    /write_composition/.test(trimmed)
  )
}

/** Authored projects stay on write/patch even when the chat is just “fix it”. */
export const isMotionGraphicsTurn = (input: {
  userMessage: string
  compositionId?: string | null
  craft?: StudioCraft | null
}): boolean =>
  input.craft === 'motion' ||
  input.compositionId === 'authored' ||
  isMotionGraphicsBrief(input.userMessage)
