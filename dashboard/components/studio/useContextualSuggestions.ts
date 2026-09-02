'use client'

import type { Suggestion } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAlreadyInPlaceStudioError } from '@/lib/humanize-studio-error'
import { defaultSelectedSuggestionIds, sortSuggestions } from './contextual-drawer-helpers'

type SuggestResponse = {
  suggestions?: Suggestion[]
  sources?: { heuristic: boolean; reasoner: boolean }
  revision?: number
  projectRevision?: number
  error?: string
}

export type ContextualSuggestState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  suggestions: Suggestion[]
  selectedIds: Set<string>
  sources: { heuristic: boolean; reasoner: boolean } | null
  fetchedAtRevision: number | null
  error: string | null
  applyingId: string | null
}

const initialState: ContextualSuggestState = {
  status: 'idle',
  suggestions: [],
  selectedIds: new Set(),
  sources: null,
  fetchedAtRevision: null,
  error: null,
  applyingId: null,
}

type UseContextualSuggestionsArgs = {
  projectId: string
  clipId: string | null
  revision: number
  enabled: boolean
  onProjectApplied: (project: StudioProject) => void
  onError: (message: string) => void
}

export const useContextualSuggestions = ({
  projectId,
  clipId,
  revision,
  enabled,
  onProjectApplied,
  onError,
}: UseContextualSuggestionsArgs) => {
  const [state, setState] = useState<ContextualSuggestState>(initialState)
  const onProjectAppliedRef = useRef(onProjectApplied)
  onProjectAppliedRef.current = onProjectApplied
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const abortRef = useRef<AbortController | null>(null)
  const revisionRef = useRef(revision)
  revisionRef.current = revision

  const load = useCallback(
    async (refresh = false) => {
      if (!clipId || !enabled) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setState((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        applyingId: null,
      }))
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/suggest/clip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipId, refresh }),
          signal: controller.signal,
        })
        const body = (await response.json()) as SuggestResponse
        if (!response.ok) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: body.error ?? 'Failed to load suggestions',
          }))
          return
        }
        const suggestions = sortSuggestions(body.suggestions ?? [])
        setState({
          status: 'ready',
          suggestions,
          selectedIds: defaultSelectedSuggestionIds(suggestions),
          sources: body.sources ?? null,
          fetchedAtRevision: body.projectRevision ?? body.revision ?? revision,
          error: null,
          applyingId: null,
        })
      } catch (err) {
        if (controller.signal.aborted) return
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to load suggestions',
        }))
      }
    },
    [clipId, enabled, projectId, revision],
  )

  useEffect(() => {
    if (!enabled || !clipId) {
      abortRef.current?.abort()
      setState(initialState)
      return
    }
    void load(false)
    return () => abortRef.current?.abort()
  }, [clipId, enabled, load])

  const toggleSelected = useCallback((id: string) => {
    setState((prev) => {
      const next = new Set(prev.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, selectedIds: next }
    })
  }, [])

  const applyOne = useCallback(
    async (suggestion: Suggestion, confirmSpend = false): Promise<boolean> => {
      setState((prev) => ({ ...prev, applyingId: suggestion.id, error: null }))
      try {
        const response = await fetch(`/api/studio/projects/${projectId}/suggest/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: revisionRef.current,
            tool: suggestion.tool,
            args: suggestion.args ?? {},
            confirmSpend: confirmSpend || undefined,
          }),
        })
        const body = (await response.json()) as {
          project?: StudioProject
          error?: string
        }
        if (!response.ok || !body.project) {
          const message =
            typeof body.error === 'string' && body.error.trim()
              ? body.error
              : 'Failed to apply suggestion'
          if (isAlreadyInPlaceStudioError(message)) {
            // No-op suggestion — drop it instead of leaving a false Apply action.
            setState((prev) => ({
              ...prev,
              applyingId: null,
              error: null,
              suggestions: prev.suggestions.filter((row) => row.id !== suggestion.id),
              selectedIds: new Set([...prev.selectedIds].filter((id) => id !== suggestion.id)),
            }))
            return true
          }
          setState((prev) => ({ ...prev, applyingId: null, error: message }))
          onErrorRef.current(message)
          return false
        }
        revisionRef.current = body.project.revision
        onProjectAppliedRef.current(body.project)
        setState((prev) => ({
          ...prev,
          applyingId: null,
          suggestions: prev.suggestions.filter((row) => row.id !== suggestion.id),
          selectedIds: new Set([...prev.selectedIds].filter((id) => id !== suggestion.id)),
        }))
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply suggestion'
        setState((prev) => ({ ...prev, applyingId: null, error: message }))
        onErrorRef.current(message)
        return false
      }
    },
    [projectId],
  )

  const applySelected = useCallback(async (): Promise<boolean> => {
    const pending = state.suggestions.filter((row) => state.selectedIds.has(row.id))
    for (const suggestion of pending) {
      if (suggestion.requiresGenerator || suggestion.estimatedCostGbp > 0) {
        onErrorRef.current(
          `“${suggestion.label}” needs spend confirm — apply it alone after confirming cost.`,
        )
        continue
      }
      const ok = await applyOne(suggestion, false)
      if (!ok) return false
    }
    return true
  }, [applyOne, state.selectedIds, state.suggestions])

  const dismissOne = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      suggestions: prev.suggestions.filter((row) => row.id !== id),
      selectedIds: new Set([...prev.selectedIds].filter((selected) => selected !== id)),
    }))
  }, [])

  return {
    state,
    stale: state.fetchedAtRevision != null && state.fetchedAtRevision !== revision,
    refresh: () => void load(true),
    toggleSelected,
    applyOne,
    applySelected,
    dismissOne,
  }
}
