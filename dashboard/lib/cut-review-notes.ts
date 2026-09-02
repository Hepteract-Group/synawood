import {
  formatCutReviewRubric,
  type StudioProjectCutReview,
} from '@synawood/creative/project/client'

export const cutReviewNotesDismissKey = (projectId: string, reviewAt: string): string =>
  `mos.studio.dismissedCutReviewNotes:${projectId}:${reviewAt}`

export type CutReviewNotesDismissLevel = 'none' | 'banner' | 'all'

export const readCutReviewNotesDismissLevel = (
  projectId: string,
  reviewAt: string,
): CutReviewNotesDismissLevel => {
  try {
    const value = localStorage.getItem(cutReviewNotesDismissKey(projectId, reviewAt))
    if (value === 'all') return 'all'
    if (value === '1' || value === 'banner') return 'banner'
    return 'none'
  } catch {
    return 'none'
  }
}

export const readCutReviewNotesDismissed = (projectId: string, reviewAt: string): boolean =>
  readCutReviewNotesDismissLevel(projectId, reviewAt) !== 'none'

export const markCutReviewNotesDismissed = (
  projectId: string,
  reviewAt: string,
  level: Exclude<CutReviewNotesDismissLevel, 'none'> = 'banner',
): void => {
  try {
    localStorage.setItem(
      cutReviewNotesDismissKey(projectId, reviewAt),
      level === 'all' ? 'all' : '1',
    )
  } catch {
    // Private mode — session dismiss still works.
  }
}

export const hasCutReviewNotesContent = (
  cutReview: StudioProjectCutReview | null | undefined,
): boolean => {
  if (!cutReview) return false
  if (cutReview.notes?.trim()) return true
  if (cutReview.rubric && formatCutReviewRubric(cutReview.rubric).length > 0) return true
  return false
}

export const summarizeCutReviewNotes = (
  cutReview: StudioProjectCutReview,
): { failedChecks: string; notes: string | null } => ({
  failedChecks: cutReview.rubric ? formatCutReviewRubric(cutReview.rubric) : '',
  notes: cutReview.notes?.trim() ? cutReview.notes.trim() : null,
})
