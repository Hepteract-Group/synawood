import { describe, expect, it } from 'vitest'
import {
  clearStudioChromeDismissed,
  isStudioChromeDismissed,
  markStudioChromeDismissed,
} from './studio-chrome-dismiss'

const memory = () => {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  }
}

describe('studio chrome dismiss (#634)', () => {
  it('hides a ready banner after dismiss for that id only', () => {
    const storage = memory()
    const projectId = '22222222-2222-4222-8222-222222222222'
    markStudioChromeDismissed('extract', projectId, 'job-1', storage)
    expect(isStudioChromeDismissed('extract', projectId, 'job-1', storage)).toBe(true)
    expect(isStudioChromeDismissed('extract', projectId, 'job-2', storage)).toBe(false)
  })

  it('clears dismiss so a later reopen can shout again', () => {
    const storage = memory()
    const projectId = '22222222-2222-4222-8222-222222222222'
    markStudioChromeDismissed('extract', projectId, 'job-1', storage)
    clearStudioChromeDismissed('extract', projectId, storage)
    expect(isStudioChromeDismissed('extract', projectId, 'job-1', storage)).toBe(false)
  })
})
