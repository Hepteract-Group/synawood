import { describe, expect, it, beforeEach } from 'vitest'
import {
  cutReviewNotesDismissKey,
  hasCutReviewNotesContent,
  markCutReviewNotesDismissed,
  readCutReviewNotesDismissed,
  summarizeCutReviewNotes,
} from './cut-review-notes'

const memory = new Map<string, string>()

describe('cut review notes (#1244)', () => {
  beforeEach(() => {
    memory.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value)
        },
        clear: () => memory.clear(),
      },
    })
  })
  it('detects notes and failed rubric dimensions', () => {
    expect(
      hasCutReviewNotesContent({
        passed: false,
        fingerprint: 'fp',
        frames: [0],
        at: '2026-08-29T00:00:00.000Z',
      }),
    ).toBe(false)
    expect(
      hasCutReviewNotesContent({
        passed: false,
        fingerprint: 'fp',
        frames: [0],
        notes: 'Coverage gap at 12s.',
        at: '2026-08-29T00:00:00.000Z',
      }),
    ).toBe(true)
    expect(
      hasCutReviewNotesContent({
        passed: true,
        fingerprint: 'fp',
        frames: [0],
        rubric: {
          coverage: 'pass',
          motion: 'fail',
          size: 'pass',
          audio: 'pass',
          brand: 'pass',
          brief: 'pass',
        },
        at: '2026-08-29T00:00:00.000Z',
      }),
    ).toBe(true)
  })

  it('summarizes failed dimensions and notes', () => {
    const summary = summarizeCutReviewNotes({
      passed: false,
      fingerprint: 'fp',
      frames: [0],
      notes: 'Motion still reads like a slideshow.',
      rubric: {
        coverage: 'pass',
        motion: 'fail',
        size: 'pass',
        audio: 'pass',
        brand: 'fail',
        brief: 'pass',
      },
      at: '2026-08-29T00:00:00.000Z',
    })
    expect(summary.failedChecks).toBe('motion, brand')
    expect(summary.notes).toBe('Motion still reads like a slideshow.')
  })

  it('persists dismiss across reload-equivalent reads', () => {
    localStorage.clear()
    const projectId = '22222222-2222-4222-8222-222222222222'
    const reviewAt = '2026-08-29T00:00:00.000Z'
    expect(readCutReviewNotesDismissed(projectId, reviewAt)).toBe(false)
    markCutReviewNotesDismissed(projectId, reviewAt)
    expect(localStorage.getItem(cutReviewNotesDismissKey(projectId, reviewAt))).toBe('1')
    expect(readCutReviewNotesDismissed(projectId, reviewAt)).toBe(true)
  })

  it('fully hides notes until a new review identity (#1371)', () => {
    localStorage.clear()
    const projectId = '22222222-2222-4222-8222-222222222222'
    const reviewAt = '2026-08-29T00:00:00.000Z'
    markCutReviewNotesDismissed(projectId, reviewAt, 'all')
    expect(readCutReviewNotesDismissed(projectId, reviewAt)).toBe(true)
    expect(localStorage.getItem(cutReviewNotesDismissKey(projectId, reviewAt))).toBe('all')
  })
})
