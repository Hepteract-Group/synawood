import type { Intent, Scene } from '../intent/schema'
import { intentHasContent } from './has-content'

/** Hard cap so Intent + Scenes never blow the Studio Agent prompt (plan 08 / ADR-0026). */
export const INTENT_SCENES_PROMPT_MAX_CHARS = 1200

const formatAudience = (intent: Intent): string | undefined => {
  const audience = intent.audience
  if (!audience) return undefined
  const bits: string[] = []
  if (audience.persona) bits.push(audience.persona)
  if (audience.ageRange) bits.push(`(${audience.ageRange[0]}-${audience.ageRange[1]})`)
  if (audience.context) bits.push(`- ${audience.context}`)
  if (audience.awarenessStage) bits.push(`awareness: ${audience.awarenessStage}`)
  if (audience.language) bits.push(`language: ${audience.language}`)
  if (audience.primaryPain) bits.push(`pain: ${audience.primaryPain}`)
  if (bits.length === 0) return undefined
  return `audience: ${bits.join(' ')}`
}

const formatIntentLines = (intent: Intent): string[] => {
  const lines: string[] = []
  const primary: string[] = []
  if (intent.goal) primary.push(`goal: ${intent.goal}`)
  if (intent.platform) primary.push(`platform: ${intent.platform}`)
  if (intent.emotion) primary.push(`emotion: ${intent.emotion}`)
  if (intent.lengthSeconds != null) primary.push(`length: ${intent.lengthSeconds}s`)
  if (primary.length > 0) lines.push(primary.join('   '))
  if (intent.goalNote) lines.push(`goalNote: ${intent.goalNote}`)
  if (intent.funnelStage) lines.push(`funnelStage: ${intent.funnelStage}`)
  if (intent.kpi) lines.push(`kpi: ${intent.kpi}`)
  if (intent.desiredBehaviour) lines.push(`desiredBehaviour: ${intent.desiredBehaviour}`)
  const audience = formatAudience(intent)
  if (audience) lines.push(audience)
  if (intent.primaryMessage) lines.push(`primaryMessage: ${intent.primaryMessage}`)
  if (intent.supportingPoints && intent.supportingPoints.length > 0) {
    lines.push(`supportingPoints: ${intent.supportingPoints.join('; ')}`)
  }
  if (intent.cta) lines.push(`CTA: ${intent.cta}`)
  if (intent.brandVoice) lines.push(`brandVoice: ${intent.brandVoice}`)
  if (intent.keywords.length > 0) lines.push(`keywords: ${intent.keywords.join(', ')}`)
  return lines
}

const formatSceneLine = (scene: Scene, includeNote: boolean): string => {
  const target =
    scene.targetDurationFrames != null ? ` (targetFrames ${scene.targetDurationFrames})` : ''
  const locked = scene.locked ? ' [locked]' : ''
  const clips = scene.clipIds.length > 0 ? ` clips:${scene.clipIds.length}` : ''
  let note = ''
  if (includeNote) {
    if (scene.intentNote) {
      note = ` - ${scene.intentNote.replace(/\s+/g, ' ').trim()}`
    } else if (scene.label) {
      note = ` - ${scene.label}`
    }
  }
  return `${scene.id} ${scene.role}${target}${locked}${clips}${note}`
}

/**
 * Compact INTENT / SCENES block for the Studio Agent system prompt.
 * Omits empty fields. Truncates by dropping scene notes first, then scene rows, then intent detail.
 */
export const summarizeIntentScenes = (
  intent: Intent,
  scenes: Scene[],
  maxChars = INTENT_SCENES_PROMPT_MAX_CHARS,
): string => {
  if (!intentHasContent(intent) && scenes.length === 0) {
    return [
      '## Intent and scenes',
      '(empty - call set_intent / plan_scenes when the founder sets creative direction)',
    ].join('\n')
  }

  const build = (includeNotes: boolean, maxScenes: number): string => {
    const lines = ['## Intent and scenes', 'INTENT']
    const intentLines = formatIntentLines(intent)
    if (intentLines.length === 0) {
      lines.push('(no fields set)')
    } else {
      lines.push(...intentLines)
    }
    lines.push('', 'SCENES')
    if (scenes.length === 0) {
      lines.push('(none - use plan_scenes then apply_scene_plan)')
    } else {
      const shown = scenes.slice(0, maxScenes)
      for (const scene of shown) {
        lines.push(formatSceneLine(scene, includeNotes))
      }
      if (scenes.length > maxScenes) {
        lines.push(`… +${scenes.length - maxScenes} more scenes omitted`)
      }
    }
    return lines.join('\n')
  }

  let text = build(true, scenes.length)
  if (text.length <= maxChars) return text

  text = build(false, scenes.length)
  if (text.length <= maxChars) return text

  let maxScenes = scenes.length
  while (maxScenes > 0) {
    text = build(false, maxScenes)
    if (text.length <= maxChars) return text
    maxScenes -= 1
  }

  return `${text.slice(0, Math.max(0, maxChars - 1))}…`
}
