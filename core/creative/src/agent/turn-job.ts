import { isMusicChangeRequest, isMusicRequest, isVoiceoverRequest } from './force-generate'
import { isMotionGraphicsBrief } from './motion-brief'

export type TurnJob =
  | 'audio.voice'
  | 'audio.music'
  | 'audio.remove'
  | 'audio.trim'
  | 'picture.patch'
  | 'picture.write'
  | 'picture.bind'
  | 'makeAd'
  | 'extract.pages'
  | 'other'

/** Faster / larger type on an already-compiled authored ad — MiniMax must patch, not narrate springs. */
export const isPaceOrTypeChangeRequest = (userMessage: string): boolean =>
  /too slow|faster (?:pace|motion|tempo)|increase.{0,40}pace|text.{0,40}too small|too small.{0,40}text|larger (?:text|type|font)|text size|bigger (?:type|text)/i.test(
    userMessage,
  )

export const isRemoveAudioRequest = (userMessage: string): boolean =>
  /(?:remove|delete|drop|mute|take off|trim off)\s+(?:the\s+|this\s+|that\s+)?(?:voice\s*-?over|voiceover|\bvo\b|music(?:\s+bed)?|narration|audio(?:\s+clip)?|\bbed\b)/i.test(
    userMessage,
  )

export const isTrimAudioRequest = (userMessage: string): boolean =>
  /(?:shorten|trim|cut(?:\s+down)?)\s+(?:the\s+|this\s+|that\s+)?(?:voice\s*-?over|voiceover|music(?:\s+bed)?|audio|bed)/i.test(
    userMessage,
  )

export const isPictureWriteRequest = (userMessage: string): boolean =>
  /compilation failed|compile failed|player is black|black player|remake (?:the )?(?:motion|composition|ad)|rewrite (?:the )?(?:composition|tsx|motion)|fix (?:the )?player|crashing|undefined component|forgot to export/i.test(
    userMessage,
  )

export const isPictureBindRequest = (userMessage: string): boolean =>
  /(?:use|bind|add|put)\s+(?:those\s+|the\s+|these\s+)?(?:stills|plates|images|generated images)|do not generate (?:new )?(?:images|stills)/i.test(
    userMessage,
  )

/** Public-page stills into the Extracts bin — not a make-ad / music turn. Needs a URL. */
export const isExtractRequest = (userMessage: string): boolean => {
  const text = userMessage.trim()
  if (!/https?:\/\//i.test(text)) return false
  return /(?:extracts?\s+bin|(?:extract|crawl|capture)\s+(?:this\s+)?(?:the\s+)?(?:product\s+)?(?:page|site|url)|\bextract\b)/i.test(
    text,
  )
}

/** First match wins — leftover inspect debt never invents picture.write by itself. */
export const classifyTurnJob = (input: {
  userMessage: string
  compositionId?: string | null
  sourceChars?: number
  cutReviewPassed?: boolean | null
}): TurnJob => {
  const message = input.userMessage
  const empty = (input.sourceChars ?? 0) < 40
  const authored = input.compositionId === 'authored'

  if (isRemoveAudioRequest(message)) return 'audio.remove'
  if (isTrimAudioRequest(message)) return 'audio.trim'
  if (isExtractRequest(message)) return 'extract.pages'
  if (isVoiceoverRequest(message)) return 'audio.voice'
  if (
    isMusicChangeRequest(message) ||
    (isMusicRequest(message) && !isPaceOrTypeChangeRequest(message))
  ) {
    return 'audio.music'
  }
  if (authored && isPictureBindRequest(message)) return 'picture.bind'
  if (authored && isPaceOrTypeChangeRequest(message) && !empty) return 'picture.patch'
  if (authored && isPictureWriteRequest(message)) return 'picture.write'
  if (authored && empty) return isMotionGraphicsBrief(message) ? 'makeAd' : 'picture.write'
  if (isMotionGraphicsBrief(message)) return 'makeAd'
  return 'other'
}

export const forcedToolsForJob = (
  job: TurnJob,
  opts?: {
    forceWrite?: boolean
    forcePatch?: boolean
    forceMusic?: boolean
    forceVoiceover?: boolean
  },
): string[] => {
  const queue: string[] = []
  switch (job) {
    case 'audio.voice':
      if (opts?.forceVoiceover) queue.push('generate_voiceover')
      queue.push('duck_music')
      queue.push('inspect_preview')
      break
    case 'audio.music':
      if (opts?.forceMusic) queue.push('generate_music')
      queue.push('inspect_preview')
      break
    case 'audio.remove':
      queue.push('remove_clip')
      break
    case 'audio.trim':
      queue.push('trim_clip')
      break
    case 'picture.patch':
    case 'picture.bind':
      queue.push('patch_composition')
      queue.push('inspect_preview')
      break
    case 'picture.write':
      queue.push('write_composition')
      if (opts?.forceMusic) queue.push('generate_music')
      if (opts?.forceVoiceover) queue.push('generate_voiceover')
      queue.push('inspect_preview')
      break
    case 'makeAd':
      if (opts?.forceWrite) queue.push('write_composition')
      else if (opts?.forcePatch) queue.push('patch_composition')
      if (opts?.forceVoiceover) queue.push('generate_voiceover')
      if (opts?.forceMusic) queue.push('generate_music')
      if (opts?.forceWrite || opts?.forcePatch || opts?.forceVoiceover || opts?.forceMusic) {
        queue.push('inspect_preview')
      }
      break
    case 'extract.pages':
      queue.push('extract_product_pages')
      break
    case 'other':
      if (opts?.forceWrite) queue.push('write_composition')
      else if (opts?.forcePatch) queue.push('patch_composition')
      if (opts?.forceVoiceover) queue.push('generate_voiceover')
      if (opts?.forceMusic) queue.push('generate_music')
      if (opts?.forceWrite || opts?.forcePatch || opts?.forceVoiceover || opts?.forceMusic) {
        queue.push('inspect_preview')
      }
      break
  }
  return queue
}

const EXTRACT_BLOCKED_TOOLS = [
  'write_composition',
  'patch_composition',
  'generate_music',
  'generate_voiceover',
  'generate_image',
  'generate_video_clip',
  'set_motion_seed',
] as const

/** Extract turns must not spend on music or rewrite the Player. */
export const omitToolsForExtractJob = <T extends Record<string, unknown>>(tools: T): T => {
  const next = { ...tools }
  for (const name of EXTRACT_BLOCKED_TOOLS) {
    delete next[name]
  }
  return next
}
