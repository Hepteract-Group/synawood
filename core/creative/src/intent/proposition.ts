import type { Intent } from './schema'

const FEATURE_DUMP = /fast[!.,]?\s*easy[!.,]?\s*(ai[- ]powered|powerful)/i

/** Three bangs or Fast/Easy/AI. May flag punchy copy; inspect wiring is #1224. */
export const isFeatureDumpCopy = (text: string): boolean =>
  FEATURE_DUMP.test(text) || (text.match(/!/g)?.length ?? 0) >= 3

export const propositionIssues = (
  intent: Partial<Intent>,
  input: { authoredClaimedDone?: boolean } = {},
): string[] => {
  const issues: string[] = []
  const supports = intent.supportingPoints ?? []
  if (supports.length > 2) issues.push('supportingPoints exceeds 2')
  if (input.authoredClaimedDone && !(intent.primaryMessage ?? '').trim()) {
    issues.push('primaryMessage empty')
  }
  const dumpSource = [intent.primaryMessage, ...(intent.supportingPoints ?? [])].join(' ')
  if (isFeatureDumpCopy(dumpSource)) issues.push('feature-dump copy')
  return issues
}
