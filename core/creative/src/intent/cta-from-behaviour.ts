import type { Intent, IntentGoal } from './schema'
import type { StudioProject } from '../project/schema'

export const deriveCtaFromIntent = (input: {
  desiredBehaviour?: string
  goal?: IntentGoal
}): string | undefined => {
  const behaviour = input.desiredBehaviour?.trim().toLowerCase() ?? ''
  if (/\btrial\b/.test(behaviour)) {
    return /\b14[\s-]?day\b/.test(behaviour) ? 'Start a 14-day trial' : 'Start a trial'
  }
  if (/\bdemo\b/.test(behaviour)) return 'Book a demo'
  if (/\binstall\b/.test(behaviour)) return 'Install'
  if (/\bshortlist\b/.test(behaviour)) return 'Add to shortlist'
  if (input.goal === 'signup') return 'Sign up'
  return undefined
}

export const resolveEndCardText = (project: StudioProject, text?: string): string => {
  const explicit = text?.trim()
  if (explicit) return explicit
  const fromIntent = project.intent?.cta?.trim()
  if (fromIntent) return fromIntent
  const fromBrand = project.brand?.defaultCta?.trim()
  if (fromBrand) return fromBrand
  throw new Error(
    'End card text is required when Intent.cta and brand.defaultCta are both empty — set_intent first.',
  )
}

export const applyDerivedCta = (
  current: Intent,
  patch: Partial<Intent>,
  merged: Intent,
): Intent => {
  if (patch.cta !== undefined) return merged
  if (current.cta?.trim()) return merged
  const derived = deriveCtaFromIntent({
    desiredBehaviour: merged.desiredBehaviour,
    goal: merged.goal,
  })
  if (!derived) return merged
  return { ...merged, cta: derived }
}
