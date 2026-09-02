import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  clearScenePlanProgress,
  idleScenePlanProgress,
  readScenePlanProgress,
  writeScenePlanProgress,
} from './scenePlanProgress'

describe('scenePlanProgress storage', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips a preview plan', () => {
    const projectId = 'proj-1'
    writeScenePlanProgress({
      projectId,
      phase: 'preview',
      scenes: [
        {
          id: 'sc_1',
          role: 'hook',
          label: 'Cold open',
          clipIds: ['c1'],
          overlayIds: [],
          locked: false,
        },
      ],
      summary: 'ok',
      error: null,
      modalOpen: false,
      updatedAt: 1,
    })
    const restored = readScenePlanProgress(projectId)
    expect(restored.phase).toBe('preview')
    expect(restored.scenes).toHaveLength(1)
    expect(restored.modalOpen).toBe(true)
  })

  it('demotes in-flight inferring to failed after reload', () => {
    const projectId = 'proj-2'
    writeScenePlanProgress({
      projectId,
      phase: 'inferring',
      scenes: null,
      summary: null,
      error: null,
      modalOpen: true,
      updatedAt: 1,
    })
    const restored = readScenePlanProgress(projectId)
    expect(restored.phase).toBe('failed')
    expect(restored.error).toMatch(/interrupted/i)
  })

  it('clears to idle', () => {
    const projectId = 'proj-3'
    writeScenePlanProgress({
      ...idleScenePlanProgress(projectId),
      phase: 'preview',
      scenes: [
        {
          id: 'sc_1',
          role: 'hook',
          label: 'Cold open',
          clipIds: [],
          overlayIds: [],
          locked: false,
        },
      ],
      modalOpen: true,
    })
    clearScenePlanProgress(projectId)
    expect(readScenePlanProgress(projectId).phase).toBe('idle')
  })
})
