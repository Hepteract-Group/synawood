import type { ToolTraceEntry } from '../tools/types'
import type { TurnMode } from './turn-mode'

export type GroundAssistantTextInput = {
  toolTrace: ToolTraceEntry[]
  modelText: string
  /** Plan/Ask/Inspect replies are the deliverable — do not require tools (#1325). */
  turnMode?: TurnMode
}

export const NO_TOOLS_RAN_MESSAGE = 'No tools ran — no project changes this turn.'
export const NO_MUSIC_GENERATED_MESSAGE =
  'No music was generated this turn — the audio track is unchanged.'
export const NO_VOICEOVER_GENERATED_MESSAGE =
  'No voiceover was generated this turn — you will not hear a spoken track.'
export const NO_SITE_STILLS_MESSAGE =
  'No Product Extract stills were passed this turn — generated stock filled the holes.'

const CLAIMS_SITE_STILLS = new RegExp(
  [
    String.raw`\bsite stills?\b`,
    String.raw`\bproduct extracts?\b`,
    String.raw`\bscraped (?:page|still)s?\b`,
    String.raw`\bfrom the (?:product )?site\b`,
  ].join('|'),
  'i',
)

const passedStillIdsThisTurn = (toolTrace: ToolTraceEntry[]): boolean =>
  toolTrace.some((entry) => {
    if (!entry.outcome.ok) return false
    const input = entry.input as {
      sourceImageAssetIds?: unknown
      backgroundAssetId?: unknown
      assetId?: unknown
      fromExtract?: unknown
    }
    if (Array.isArray(input.sourceImageAssetIds) && input.sourceImageAssetIds.length > 0) {
      return true
    }
    if (typeof input.backgroundAssetId === 'string' && input.backgroundAssetId.length > 0) {
      return true
    }
    return entry.toolName === 'generate_slide_background' && input.fromExtract === true
  })
export const SWITCH_TO_EXECUTE_MESSAGE =
  'Plan mode cannot make the ad. Switch the footer to Execute, then send again.'
export const ASK_CANNOT_MAKE_MESSAGE =
  'Ask mode cannot change the project. Switch the footer to Execute, then send again.'
export const INSPECT_CANNOT_MAKE_MESSAGE =
  'Inspect cannot rewrite the composition. Switch the footer to Execute, then send again.'

/**
 * Derive the user-visible assistant *narration* (ADR-0019).
 * Tool receipts are shown separately as Activity — not stuffed into this string.
 * Still blocks narrate-without-act when no tools ran (ADR-0018).
 */
/** First-person edit / progress claims — not clarifying questions. */
const CLAIMS_EDIT = new RegExp(
  [
    String.raw`\bplease wait\b`,
    String.raw`\bi(?:'m|\s+am)\s+(?:going\s+to\s+|ready\s+to\s+)?(?:generate|add|create|place|pack|set|attach|render|process)`,
    String.raw`\bi(?:'ll|\s+will)\s+(?:generate|add|create|place|pack|set|attach|render|process)`,
    String.raw`\bi(?:'ve|\s+have)\s+(?:generated|added|created|removed|trimmed|split|packed|closed|set|attached|queued|updated|placed|moved)`,
    String.raw`\bi\s+(?:generated|added|created|removed|trimmed|split|packed|closed|attached|queued|updated|placed|moved)\b`,
    String.raw`\bsuccessfully\b`,
    String.raw`\beverything worked\b`,
  ].join('|'),
  'i',
)

/** Past-tense “I already made it” — not a Plan that *will* generate later. */
const CLAIMS_MADE_IT = new RegExp(
  [
    String.raw`\bkicked off\b`,
    String.raw`\btsx written\b`,
    String.raw`\b(?:composition|ad) written\b`,
    String.raw`\bstills generated\b`,
    String.raw`\bi(?:'ve|\s+have)\s+written\b`,
    String.raw`\bwrote (?:the |a )?(?:composition|tsx)\b`,
    String.raw`\bcut review pending\b`,
    String.raw`\bimplementation (?:kicked|started|begun|in progress)\b`,
    String.raw`\bstills bound\b`,
    String.raw`\btsx\b[\s\S]{0,80}\bon the timeline\b`,
    String.raw`\brebuilt (?:the )?(?:motion|composition|ad)\b`,
    String.raw`\brewrote (?:the )?(?:composition|tsx|motion)\b`,
  ].join('|'),
  'i',
)

const PICTURE_TOOLS = new Set([
  'write_composition',
  'patch_composition',
  'generate_image',
  'generate_video_clip',
  'add_clip',
])

const pictureToolSucceeded = (toolTrace: ToolTraceEntry[]): boolean =>
  toolTrace.some((entry) => PICTURE_TOOLS.has(entry.toolName) && entry.outcome.ok)

const claimsActedWithoutMake = (modelText: string, toolTrace: ToolTraceEntry[]): boolean =>
  CLAIMS_MADE_IT.test(modelText) &&
  !pictureToolSucceeded(toolTrace) &&
  !musicToolSucceeded(toolTrace)

const narrationCannotActMessage = (mode: Exclude<TurnMode, 'execute'>): string => {
  if (mode === 'plan') return SWITCH_TO_EXECUTE_MESSAGE
  if (mode === 'inspect') return INSPECT_CANNOT_MAKE_MESSAGE
  return ASK_CANNOT_MAKE_MESSAGE
}

/** Third-person “the carousel now has a bed” without generate_music (#1016). */
const CLAIMS_MUSIC_DONE = new RegExp(
  [
    String.raw`\bnow has\b[\s\S]{0,120}\b(?:music|bed)\b`,
    String.raw`\bplaced on the audio track\b`,
    String.raw`\b(?:orchestral|instrumental|cinematic|music) bed\b`,
    String.raw`\bfast-tempo bed\b`,
    String.raw`\b(?:bpm|tempo)\b[\s\S]{0,40}\b(?:bed|music|underscore)\b`,
  ].join('|'),
  'i',
)

const CLAIMS_VOICEOVER_DONE = new RegExp(
  [
    String.raw`\bvoice-?over\b`,
    String.raw`\bwarm[- ]female\b`,
    String.raw`\bspoken track\b`,
    String.raw`\bwith vo\b`,
    String.raw`\badded\b[\s\S]{0,40}\b(?:vo|narration)\b`,
  ].join('|'),
  'i',
)

const musicToolSucceeded = (toolTrace: ToolTraceEntry[]): boolean =>
  toolTrace.some((entry) => entry.toolName === 'generate_music' && entry.outcome.ok)

const musicToolFailed = (toolTrace: ToolTraceEntry[]): ToolTraceEntry | undefined =>
  toolTrace.find((entry) => entry.toolName === 'generate_music' && !entry.outcome.ok)

const voiceoverToolSucceeded = (toolTrace: ToolTraceEntry[]): boolean =>
  toolTrace.some((entry) => entry.toolName === 'generate_voiceover' && entry.outcome.ok)

const voiceoverToolFailed = (toolTrace: ToolTraceEntry[]): ToolTraceEntry | undefined =>
  toolTrace.find((entry) => entry.toolName === 'generate_voiceover' && !entry.outcome.ok)

const synthesizeFromTrace = (toolTrace: ToolTraceEntry[]): string => {
  const ok = toolTrace.filter((entry) => entry.outcome.ok)
  const failed = toolTrace.filter((entry) => !entry.outcome.ok)
  if (ok.length === 0 && failed.length > 0) {
    const first = failed[0]!
    const err = first.outcome.ok ? 'unknown error' : first.outcome.error
    return `That didn’t work: ${err}. Want to try a different approach?`
  }
  const bits = ok
    .slice(0, 2)
    .map((entry) => (entry.outcome.ok ? entry.outcome.summary : ''))
    .filter(Boolean)
  const head = bits.join('. ').replace(/\.\s*$/, '')
  const more = ok.length > 2 ? '…' : ''
  const failNote =
    failed.length > 0
      ? ` (${failed.length} step${failed.length === 1 ? '' : 's'} failed — see Activity)`
      : ''
  return `${head || 'Done'}${more}${failNote}. What should we do next?`
}

const groundedMusicClaim = (toolTrace: ToolTraceEntry[]): string => {
  const failed = musicToolFailed(toolTrace)
  if (failed && !failed.outcome.ok) {
    return `That didn’t work: ${failed.outcome.error}. Want to try a different approach?`
  }
  if (toolTrace.length === 0) return NO_TOOLS_RAN_MESSAGE
  return NO_MUSIC_GENERATED_MESSAGE
}

const groundedVoiceoverClaim = (toolTrace: ToolTraceEntry[]): string => {
  const failed = voiceoverToolFailed(toolTrace)
  if (failed && !failed.outcome.ok) {
    return `That didn’t work: ${failed.outcome.error}. Want to try a different approach?`
  }
  if (toolTrace.length === 0) return NO_TOOLS_RAN_MESSAGE
  return NO_VOICEOVER_GENERATED_MESSAGE
}

const withUngroundedAudioNotes = (
  modelText: string,
  toolTrace: ToolTraceEntry[],
): string | null => {
  const musicLie = CLAIMS_MUSIC_DONE.test(modelText) && !musicToolSucceeded(toolTrace)
  const voLie = CLAIMS_VOICEOVER_DONE.test(modelText) && !voiceoverToolSucceeded(toolTrace)
  if (!musicLie && !voLie) return null
  const notes: string[] = []
  if (pictureToolSucceeded(toolTrace) || toolTrace.some((entry) => entry.outcome.ok)) {
    notes.push(synthesizeFromTrace(toolTrace))
  }
  if (voLie) notes.push(groundedVoiceoverClaim(toolTrace))
  if (musicLie) notes.push(groundedMusicClaim(toolTrace))
  return notes.join('\n\n')
}

const EMPTY_NARRATION: Record<Exclude<TurnMode, 'execute'>, string> = {
  plan: 'I could not draft a plan this turn. Stay on Plan and send the brief again.',
  ask: 'I could not answer that from the project. Ask again.',
  inspect: 'I could not review the player this turn. Stay on Inspect and ask me to watch it again.',
}

const isNarrationMode = (mode: TurnMode | undefined): mode is Exclude<TurnMode, 'execute'> =>
  mode === 'plan' || mode === 'ask' || mode === 'inspect'

export const groundAssistantText = (input: GroundAssistantTextInput): string => {
  const modelText = input.modelText.trim()
  const { toolTrace } = input

  if (isNarrationMode(input.turnMode)) {
    if (claimsActedWithoutMake(modelText, toolTrace)) {
      return narrationCannotActMessage(input.turnMode)
    }
    return modelText || EMPTY_NARRATION[input.turnMode]
  }

  const audioGrounded = withUngroundedAudioNotes(modelText, toolTrace)
  if (audioGrounded) return audioGrounded

  if (CLAIMS_SITE_STILLS.test(modelText) && !passedStillIdsThisTurn(toolTrace)) {
    return NO_SITE_STILLS_MESSAGE
  }

  if (toolTrace.length === 0) {
    if (modelText && !CLAIMS_EDIT.test(modelText) && !CLAIMS_MADE_IT.test(modelText)) {
      return modelText
    }
    return NO_TOOLS_RAN_MESSAGE
  }

  if (claimsActedWithoutMake(modelText, toolTrace)) {
    return NO_TOOLS_RAN_MESSAGE
  }

  // ADR-0019: prefer conversational model narration when tools actually ran.
  if (modelText) {
    return modelText
  }

  return synthesizeFromTrace(toolTrace)
}
