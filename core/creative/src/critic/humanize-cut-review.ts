/** Founder-facing cut-review copy. Agent instructions stay out of the chat bubble. */

const AGENT_SPEAK =
  /\s*(?:Fix the timeline and )?call inspect_preview again\.?\s*|Do not say the video is done\.?\s*|I cannot say the video is done\.?\s*/gi

export const isCutReviewRenderInternals = (message: string): boolean =>
  /React\.createContext|use client|Server Component|Remotion requires|cut-review worker|snapshot timed out/i.test(
    message,
  )

export const humanizeCutReviewForFounder = (message: string | undefined): string => {
  const text = (message ?? '').replace(AGENT_SPEAK, ' ').replace(/\s+/g, ' ').trim()
  if (!text) {
    return 'Automatic player review did not finish. Press play and tell me what to change.'
  }
  if (isCutReviewRenderInternals(text) || /could not render player frames/i.test(text)) {
    return 'I could not snapshot the player for review. Press play to watch the clip. I am not marking this finished until a snapshot works.'
  }
  if (/inspect_preview did not run/i.test(text)) {
    return 'Automatic player review did not run. Press play and tell me what to change.'
  }
  if (/timeline changed after cut review/i.test(text)) {
    return 'The timeline changed after the last review. Press play, then ask me to review again.'
  }
  return text
}

export const founderCutReviewStatus = (inspectError?: string): string =>
  `I am not calling this done yet. ${humanizeCutReviewForFounder(inspectError)}`
