/** Merge skill-pack priors (ADR-0036 / #252). Local overlay wins. */

import type { SkillPriors } from './schema'
import { emptyPriors, parsePriors } from './schema'

export const mergePriors = (...layers: unknown[]): SkillPriors => {
  const base = emptyPriors()
  return layers.reduce<SkillPriors>((current, layer) => {
    const next = parsePriors(layer)
    return {
      structure: { ...current.structure, ...next.structure },
      hooks: { ...current.hooks, ...next.hooks },
    }
  }, base)
}
