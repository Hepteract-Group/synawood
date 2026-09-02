import { assertStylePackPublishable } from '../effects/license-gate'
import { assertTreatmentsPublishable } from '../effects/treatments'
import { assertVoiceProvenancePublishable } from '../voice/provenance-gate'
import { cutReviewRequired, hasFreshCutReview } from './cut-review-state'
import { evaluatePictureCompleteness } from './picture-completeness'
import type { StudioProject } from './schema'

export type AdReadyIssue = {
  code: string
  message: string
}

/** Sync Approve/ad-ready blockers (no DB). Music license is checked on the server. */
export const listAdReadyIssues = (project: StudioProject): AdReadyIssue[] => {
  const issues: AdReadyIssue[] = []
  const report = evaluatePictureCompleteness(project)
  for (const failure of report.failures) {
    issues.push({ code: failure.code, message: failure.message })
  }
  if (cutReviewRequired(project) && !hasFreshCutReview(project)) {
    issues.push({
      code: 'cut_review',
      message: 'Inspect this cut first.',
    })
  }
  try {
    assertStylePackPublishable(project.stylePackId)
  } catch (error) {
    issues.push({
      code: 'style_pack',
      message: error instanceof Error ? error.message : 'Style pack is not Final-eligible.',
    })
  }
  try {
    assertVoiceProvenancePublishable(project)
  } catch (error) {
    issues.push({
      code: 'voice',
      message: error instanceof Error ? error.message : 'Voice provenance blocked Approve.',
    })
  }
  for (const clip of project.clips) {
    try {
      assertTreatmentsPublishable(clip.treatments)
    } catch (error) {
      issues.push({
        code: 'treatment',
        message: error instanceof Error ? error.message : 'Treatment is not Final-eligible.',
      })
      break
    }
  }
  return issues
}

export const adReadySummary = (issues: AdReadyIssue[]): string => {
  if (issues.length === 0) return 'Ad-ready: video, music, brand, and cut review are set.'
  if (issues.length === 1) return issues[0]?.message ?? 'Not ad-ready yet.'
  return `${issues.length} blockers before Approve. ${issues[0]?.message}`
}
