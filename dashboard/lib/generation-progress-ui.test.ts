import { describe, expect, it } from 'vitest'
import {
  formatGenerationJobLine,
  newInFlightJobIds,
  operatorFacingGenerationJobs,
  shouldShowGenerationToast,
  summarizeInFlightGeneration,
} from './generation-progress-ui'

const job = (
  id: string,
  role: string,
  status: 'queued' | 'generating' | 'failed' = 'generating',
) => ({
  id,
  role,
  status,
  errorMessage: null,
})

describe('generation progress chrome (#1013)', () => {
  it('hides index jobs from Studio generation chrome', () => {
    const jobs = [job('img-1', 'image'), job('idx-1', 'index')]
    expect(operatorFacingGenerationJobs(jobs).map((row) => row.id)).toEqual(['img-1'])
  })

  it('does not pulse a toast for in-flight jobs the operator already saw', () => {
    const current = ['img-1', 'img-2']
    const seen = new Set(['img-1', 'img-2'])
    const newIds = newInFlightJobIds(current, seen)
    expect(newIds).toEqual([])
    expect(shouldShowGenerationToast({ newInFlightIds: newIds, unseenFailedIds: [] })).toBe(false)
  })

  it('pulses a toast when new in-flight ids appear, including after index-only work', () => {
    expect(shouldShowGenerationToast({ newInFlightIds: ['img-3'], unseenFailedIds: [] })).toBe(true)
    expect(shouldShowGenerationToast({ newInFlightIds: [], unseenFailedIds: ['fail-1'] })).toBe(
      true,
    )
  })

  it('collapses many slide backgrounds into one line', () => {
    expect(formatGenerationJobLine(job('a', 'image'))).toBe('Generating slide background…')
    expect(
      summarizeInFlightGeneration([job('a', 'image'), job('b', 'image'), job('c', 'image')]),
    ).toBe('Generating 3 slide backgrounds…')
    expect(summarizeInFlightGeneration([job('m', 'music'), job('i', 'image')])).toBe(
      'Working on 2 jobs…',
    )
  })
})
