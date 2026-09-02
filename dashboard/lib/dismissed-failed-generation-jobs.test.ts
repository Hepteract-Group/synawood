import { describe, expect, it } from 'vitest'
import {
  isRetryableGenerationFailure,
  loadDismissedFailedGenerationJobs,
  persistDismissedFailedGenerationJobs,
  unseenFailedJobIds,
} from './dismissed-failed-generation-jobs'

const memory = () => {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('dismissed failed generation jobs (#851)', () => {
  it('round-trips dismissed ids', () => {
    const storage = memory()
    persistDismissedFailedGenerationJobs('proj-1', new Set(['a', 'b']), storage)
    expect([...loadDismissedFailedGenerationJobs('proj-1', storage)].sort()).toEqual(['a', 'b'])
    expect(loadDismissedFailedGenerationJobs('proj-2', storage).size).toBe(0)
  })

  it('does not treat shrinking failed lists as new failures', () => {
    const seen = new Set(['a', 'b', 'c'])
    expect(unseenFailedJobIds(['a', 'b'], seen)).toEqual([])
  })

  it('does not treat Seedance duration rejects as retryable', () => {
    expect(
      isRetryableGenerationFailure(
        'The parameter duration specified in the request is not valid for model dreamina-seedance-2-0 in t2v',
      ),
    ).toBe(false)
    expect(isRetryableGenerationFailure('Gateway 429 rate limit, retry later')).toBe(true)
  })
})
