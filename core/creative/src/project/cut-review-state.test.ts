import { describe, expect, it } from 'vitest'
import { createEmptyProject, parseStudioProject } from './schema'
import {
  cutReviewFingerprint,
  formatCutReviewRubric,
  hasFreshCutReview,
  stampCutReview,
  stampFailedCutReview,
  stampPassedCutReview,
  type CutReviewRubricDimensions,
} from './cut-review-state'

const sampleRubric = (): CutReviewRubricDimensions => ({
  coverage: 'pass',
  motion: 'fail',
  size: 'pass',
  audio: 'pass',
  brand: 'fail',
  brief: 'pass',
})

describe('cutReview rubric (#1244)', () => {
  it('parseStudioProject accepts cutReview.rubric', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const withReview = parseStudioProject({
      ...project,
      cutReview: {
        passed: false,
        fingerprint: cutReviewFingerprint(project),
        frames: [0, 450, 899],
        notes: 'Motion still reads like a slideshow.',
        rubric: sampleRubric(),
        at: '2026-08-29T00:00:00.000Z',
      },
    })
    expect(withReview.cutReview?.rubric?.motion).toBe('fail')
    expect(withReview.cutReview?.notes).toBe('Motion still reads like a slideshow.')
  })

  it('stampPassedCutReview stores rubric when provided', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const rubric: CutReviewRubricDimensions = {
      coverage: 'pass',
      motion: 'pass',
      size: 'pass',
      audio: 'pass',
      brand: 'pass',
      brief: 'pass',
    }
    const stamped = stampPassedCutReview(project, [0, 450, 899], 'Looks good.', rubric)
    expect(stamped.cutReview?.passed).toBe(true)
    expect(stamped.cutReview?.rubric).toEqual(rubric)
    expect(stamped.cutReview?.notes).toBe('Looks good.')
    expect(hasFreshCutReview(stamped)).toBe(true)
  })

  it('stampFailedCutReview sets passed:false and hasFreshCutReview is false', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const stamped = stampFailedCutReview(
      project,
      [0, 450, 899],
      'Tiny corner graphic.',
      sampleRubric(),
    )
    expect(stamped.cutReview?.passed).toBe(false)
    expect(stamped.cutReview?.rubric?.brand).toBe('fail')
    expect(hasFreshCutReview(stamped)).toBe(false)
  })

  it('round-trips rubric and notes through parseStudioProject', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const stamped = stampCutReview(project, {
      passed: false,
      frames: [0, 100],
      notes: 'Coverage gap at 12s.',
      rubric: sampleRubric(),
    })
    const again = parseStudioProject(JSON.parse(JSON.stringify(stamped)))
    expect(again.cutReview?.rubric).toEqual(sampleRubric())
    expect(again.cutReview?.notes).toBe('Coverage gap at 12s.')
    expect(again.cutReview?.passed).toBe(false)
  })

  it('formatCutReviewRubric lists failed dimensions', () => {
    expect(formatCutReviewRubric(sampleRubric())).toBe('motion, brand')
    expect(
      formatCutReviewRubric({
        coverage: 'pass',
        motion: 'pass',
        size: 'pass',
        audio: 'pass',
        brand: 'pass',
        brief: 'pass',
      }),
    ).toBe('')
  })
})
