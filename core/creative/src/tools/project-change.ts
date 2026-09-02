import type { StudioProject } from '../project/schema'

/** Content identity for no-op detection — revision alone does not count as a change. */
export const projectContentFingerprint = (project: StudioProject): string => {
  const { revision: _revision, ...content } = project
  return JSON.stringify(content)
}

/**
 * ADR-0018 post-gate: a mutating tool must change project content.
 * No-op ≠ success (even if revision was bumped).
 */
export const assertProjectChanged = (
  before: StudioProject,
  after: StudioProject,
  label = 'Mutation',
): void => {
  if (projectContentFingerprint(before) === projectContentFingerprint(after)) {
    throw new Error(`${label} had nothing new to apply — the project already matches those inputs.`)
  }
}
