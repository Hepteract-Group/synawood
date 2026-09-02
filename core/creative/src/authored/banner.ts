export type AuthoredBannerKind =
  'empty' | 'compile' | 'blocked-import' | 'building' | 'runtime' | 'voiceover-late' | null

export type AuthoredBanner = {
  kind: Exclude<AuthoredBannerKind, null>
  message: string
}

export const VOICEOVER_LATE_BANNER_MESSAGE =
  'Voiceover starts after the picture — it will not play during the ad. Ask the agent to put it on from frame 0.'

export const authoredCompileBanner = (input: {
  compiling?: boolean
  compileError?: string | null
  runtimeError?: string | null
  source?: string | null
  voiceoverStartsAfterPicture?: boolean
}): AuthoredBanner | null => {
  if (input.compiling) {
    return { kind: 'building', message: 'Building preview' }
  }
  const runtime = input.runtimeError?.trim() ?? ''
  if (runtime.length > 0) {
    return {
      kind: 'runtime',
      message: `Playback stopped on this frame. ${runtime} Ask the agent to patch that beat.`,
    }
  }
  const error = input.compileError?.trim() ?? ''
  if (error.length > 0) {
    if (/blocked import|blocked require|blocked library/i.test(error)) {
      return {
        kind: 'blocked-import',
        message:
          'That composition used a blocked library. Ask in chat to rebuild with the motion kit.',
      }
    }
    return {
      kind: 'compile',
      message:
        "This motion ad didn't compile. The agent has the error — ask it to fix, or say what you wanted instead.",
    }
  }
  if (!input.source || input.source.trim().length === 0) {
    return {
      kind: 'empty',
      message: 'This motion ad has no composition source yet. Ask the agent to write the motion.',
    }
  }
  if (input.voiceoverStartsAfterPicture) {
    return {
      kind: 'voiceover-late',
      message: VOICEOVER_LATE_BANNER_MESSAGE,
    }
  }
  return null
}
