import { z } from 'zod'

export const CUT_REVIEW_CHECKS = ['coverage', 'motion', 'size', 'audio', 'brand', 'brief'] as const

export type CutReviewCheck = (typeof CUT_REVIEW_CHECKS)[number]
export type CutReviewVerdict = 'pass' | 'fail'

export const cutReviewRubricDimensionsSchema = z
  .object({
    coverage: z.enum(['pass', 'fail']),
    motion: z.enum(['pass', 'fail']),
    size: z.enum(['pass', 'fail']),
    audio: z.enum(['pass', 'fail']),
    brand: z.enum(['pass', 'fail']),
    brief: z.enum(['pass', 'fail']),
  })
  .strict()

export type CutReviewRubricDimensions = z.infer<typeof cutReviewRubricDimensionsSchema>

const CHECK_LABELS: Record<CutReviewCheck, string> = {
  coverage: 'coverage',
  motion: 'motion',
  size: 'size',
  audio: 'audio',
  brand: 'brand',
  brief: 'brief',
}

export const formatCutReviewRubric = (rubric: CutReviewRubricDimensions): string =>
  CUT_REVIEW_CHECKS.filter((check) => rubric[check] === 'fail')
    .map((check) => CHECK_LABELS[check])
    .join(', ')

export const rubricDimensionsFromFull = (
  rubric: CutReviewRubricDimensions & { notes?: string },
): CutReviewRubricDimensions =>
  cutReviewRubricDimensionsSchema.parse({
    coverage: rubric.coverage,
    motion: rubric.motion,
    size: rubric.size,
    audio: rubric.audio,
    brand: rubric.brand,
    brief: rubric.brief,
  })
