'use client'

import type { Scene } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import { useCallback, useEffect, useState } from 'react'
import {
  clearScenePlanProgress,
  idleScenePlanProgress,
  readScenePlanProgress,
  writeScenePlanProgress,
  type ScenePlanProgressState,
} from './scenePlanProgress'

type UseScenePlanProgressArgs = {
  projectId: string
  revision: number
  onProjectChanged: (project: StudioProject) => void
  onError: (message: string) => void
}

export const useScenePlanProgress = ({
  projectId,
  revision,
  onProjectChanged,
  onError,
}: UseScenePlanProgressArgs) => {
  const [state, setState] = useState<ScenePlanProgressState>(() => idleScenePlanProgress(projectId))

  useEffect(() => {
    setState(readScenePlanProgress(projectId))
  }, [projectId])

  useEffect(() => {
    writeScenePlanProgress(state)
  }, [state])

  const patch = useCallback((partial: Partial<ScenePlanProgressState>) => {
    setState((current) => ({ ...current, ...partial, updatedAt: Date.now() }))
  }, [])

  const dismiss = useCallback(() => {
    setState(idleScenePlanProgress(projectId))
    clearScenePlanProgress(projectId)
  }, [projectId])

  const openModal = useCallback(() => patch({ modalOpen: true }), [patch])
  const closeModal = useCallback(() => patch({ modalOpen: false }), [patch])

  const runInfer = useCallback(async () => {
    patch({
      phase: 'inferring',
      error: null,
      summary: null,
      scenes: null,
      modalOpen: true,
    })
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/scenes/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserveClipOrder: true }),
      })
      const body = (await response.json()) as {
        scenes?: Scene[]
        error?: string
        summary?: string
      }
      if (!response.ok || !body.scenes?.length) {
        const message = body.error ?? 'Could not infer scenes'
        patch({ phase: 'failed', error: message, modalOpen: true })
        onError(message)
        return
      }
      patch({
        phase: 'preview',
        scenes: body.scenes,
        summary: body.summary ?? null,
        error: null,
        modalOpen: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not infer scenes'
      patch({ phase: 'failed', error: message, modalOpen: true })
      onError(message)
    }
  }, [onError, patch, projectId])

  const runApply = useCallback(async (): Promise<boolean> => {
    if (!state.scenes?.length) return false
    patch({ phase: 'applying', modalOpen: true, error: null })
    try {
      const response = await fetch(`/api/studio/projects/${projectId}/scenes/apply-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, scenes: state.scenes }),
      })
      const body = (await response.json()) as { project?: StudioProject; error?: string }
      if (!response.ok || !body.project) {
        const message = body.error ?? 'Failed to apply scene plan'
        patch({ phase: 'preview', error: message, modalOpen: true })
        onError(message)
        return false
      }
      onProjectChanged(body.project)
      dismiss()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply scene plan'
      patch({ phase: 'preview', error: message, modalOpen: true })
      onError(message)
      return false
    }
  }, [dismiss, onError, onProjectChanged, patch, projectId, revision, state.scenes])

  const busy = state.phase === 'inferring' || state.phase === 'applying'
  const active = state.phase !== 'idle'

  return {
    state,
    busy,
    active,
    runInfer,
    runApply,
    dismiss,
    openModal,
    closeModal,
  }
}
