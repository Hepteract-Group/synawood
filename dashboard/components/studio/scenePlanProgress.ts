import type { Scene } from '@synawood/creative/intent'

export type ScenePlanPhase = 'idle' | 'inferring' | 'preview' | 'applying' | 'failed'

export type ScenePlanProgressState = {
  projectId: string
  phase: ScenePlanPhase
  scenes: Scene[] | null
  summary: string | null
  error: string | null
  modalOpen: boolean
  updatedAt: number
}

export const idleScenePlanProgress = (projectId: string): ScenePlanProgressState => ({
  projectId,
  phase: 'idle',
  scenes: null,
  summary: null,
  error: null,
  modalOpen: false,
  updatedAt: Date.now(),
})

const storageKey = (projectId: string): string => `mos.studio.scenePlanProgress.v1.${projectId}`

const getSessionStorage = (): Storage | null => {
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage
    return storage ?? null
  } catch {
    return null
  }
}

const isSceneArray = (value: unknown): value is Scene[] =>
  Array.isArray(value) &&
  value.every(
    (row) =>
      row &&
      typeof row === 'object' &&
      typeof (row as Scene).id === 'string' &&
      typeof (row as Scene).role === 'string' &&
      typeof (row as Scene).label === 'string' &&
      Array.isArray((row as Scene).clipIds),
  )

export const readScenePlanProgress = (projectId: string): ScenePlanProgressState => {
  const storage = getSessionStorage()
  if (!storage) return idleScenePlanProgress(projectId)
  try {
    const raw = storage.getItem(storageKey(projectId))
    if (!raw) return idleScenePlanProgress(projectId)
    const parsed = JSON.parse(raw) as Partial<ScenePlanProgressState>
    if (parsed.projectId !== projectId) return idleScenePlanProgress(projectId)
    const phase = parsed.phase
    if (
      phase !== 'inferring' &&
      phase !== 'preview' &&
      phase !== 'applying' &&
      phase !== 'failed'
    ) {
      return idleScenePlanProgress(projectId)
    }
    // In-flight HTTP cannot resume after reload — demote to recoverable terminals.
    const restoredPhase: ScenePlanPhase =
      phase === 'inferring' || phase === 'applying' ? 'failed' : phase
    const scenes = isSceneArray(parsed.scenes) ? parsed.scenes : null
    if (restoredPhase === 'preview' && (!scenes || scenes.length === 0)) {
      return idleScenePlanProgress(projectId)
    }
    return {
      projectId,
      phase: restoredPhase,
      scenes,
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      error:
        restoredPhase === 'failed'
          ? typeof parsed.error === 'string' && parsed.error
            ? parsed.error
            : 'Scene plan was interrupted — run Infer again.'
          : typeof parsed.error === 'string'
            ? parsed.error
            : null,
      modalOpen: restoredPhase === 'preview' || restoredPhase === 'failed',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return idleScenePlanProgress(projectId)
  }
}

export const writeScenePlanProgress = (state: ScenePlanProgressState): void => {
  const storage = getSessionStorage()
  if (!storage) return
  try {
    if (state.phase === 'idle') {
      storage.removeItem(storageKey(state.projectId))
      return
    }
    storage.setItem(storageKey(state.projectId), JSON.stringify(state))
  } catch {
    /* quota / private mode — banner still works for the current session */
  }
}

export const clearScenePlanProgress = (projectId: string): void => {
  writeScenePlanProgress(idleScenePlanProgress(projectId))
}
