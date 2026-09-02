import { pictureWindowFrames } from './picture-completeness'
import type { CutReviewRubricDimensions } from './cut-review-rubric'
import { isAuthoredComposition, type StudioProject } from './schema'

export {
  CUT_REVIEW_CHECKS,
  cutReviewRubricDimensionsSchema,
  formatCutReviewRubric,
  rubricDimensionsFromFull,
} from './cut-review-rubric'
export type {
  CutReviewCheck,
  CutReviewRubricDimensions,
  CutReviewVerdict,
} from './cut-review-rubric'

/** Cut review is required for ad picture windows and authored compositions. */
export const cutReviewRequired = (project: StudioProject): boolean =>
  pictureWindowFrames(project) > 0 || isAuthoredComposition(project.compositionId)

export const cutReviewFingerprint = (project: StudioProject): string =>
  JSON.stringify({
    compositionId: project.compositionId,
    durationFrames: project.durationFrames,
    clips: project.clips,
    overlays: project.overlays,
    pipLayout: project.pipLayout ?? null,
    lengthSeconds: project.intent?.lengthSeconds ?? null,
    slideshow: project.slideshow ?? null,
    stylePackId: project.stylePackId ?? null,
    compositionSource: project.compositionSource ?? null,
  })

export const hasFreshCutReview = (project: StudioProject): boolean =>
  project.cutReview?.passed === true &&
  project.cutReview.fingerprint === cutReviewFingerprint(project)

type StampCutReviewInput = {
  passed: boolean
  frames: number[]
  rubric?: CutReviewRubricDimensions
  notes?: string
}

export const stampCutReview = (
  project: StudioProject,
  input: StampCutReviewInput,
): StudioProject => ({
  ...project,
  cutReview: {
    passed: input.passed,
    fingerprint: cutReviewFingerprint(project),
    frames: input.frames,
    ...(input.rubric ? { rubric: input.rubric } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    at: new Date().toISOString(),
  },
})

export const stampPassedCutReview = (
  project: StudioProject,
  frames: number[],
  notes?: string,
  rubric?: CutReviewRubricDimensions,
): StudioProject => stampCutReview(project, { passed: true, frames, notes, rubric })

export const stampFailedCutReview = (
  project: StudioProject,
  frames: number[],
  notes?: string,
  rubric?: CutReviewRubricDimensions,
): StudioProject => stampCutReview(project, { passed: false, frames, notes, rubric })
