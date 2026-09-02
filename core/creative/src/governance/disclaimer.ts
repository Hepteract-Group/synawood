/** Apply policy disclaimer onto project JSON (#314). */

import type { StudioProject } from '../project/schema'
import { parseStudioProject } from '../project/schema'
import type { GovernancePolicyBody } from './schema'

export const withGovernanceDisclaimer = (
  project: StudioProject,
  policy: GovernancePolicyBody | null | undefined,
): StudioProject => {
  if (!policy?.disclaimer.required) {
    if (!project.governanceDisclaimer) return project
    const { governanceDisclaimer: _removed, ...rest } = project
    void _removed
    return parseStudioProject(rest)
  }
  const text = policy.disclaimer.text.trim()
  if (!text) return project
  if (project.governanceDisclaimer === text) return project
  return parseStudioProject({ ...project, governanceDisclaimer: text })
}
