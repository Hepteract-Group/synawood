import type { IntentAudience } from './schema'

const GENERIC_PERSONAS = new Set(['', 'everyone', 'everybody'])
const GENERIC_COPY = /transform your business with ai/i

/** Critic helper (#1221). Inspect wiring is #1243. */
export const isGenericAudience = (input: {
  persona?: string
  copy?: string
  language?: string
  primaryPain?: string
}): boolean => {
  const persona = (input.persona ?? '').trim().toLowerCase()
  if (GENERIC_PERSONAS.has(persona)) return true
  return [input.copy, input.language, input.primaryPain].some((text) =>
    GENERIC_COPY.test(text ?? ''),
  )
}

export const isGenericIntentAudience = (audience: IntentAudience | undefined): boolean =>
  isGenericAudience({
    persona: audience?.persona,
    language: audience?.language,
    primaryPain: audience?.primaryPain,
  })
