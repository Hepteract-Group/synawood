import type { StudioProject } from '../project/schema'

export const numbersInText = (text: string): number[] =>
  [...text.matchAll(/\d+(?:\.\d+)?/g)]
    .map((row) => Number(row[0]))
    .filter((n) => Number.isFinite(n))

/** Allowed CountUp values: brand.proofStats plus numbers already on brand/intent copy. */
export const catalogNumbersFromProject = (project: StudioProject): number[] => {
  const fromProof = (project.brand?.proofStats ?? []).map((stat) => stat.value)
  const blob = JSON.stringify({
    brand: project.brand ?? null,
    intent: project.intent ?? null,
  })
  return [...new Set([...fromProof, ...numbersInText(blob)])]
}
