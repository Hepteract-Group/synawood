'use client'

import type { Intent } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { intentPatchFromDraft, isEmptyIntentPatch } from './intent-helpers'
import {
  createIntentAutosaveQueue,
  performIntentAutosave,
  type IntentAutosaveFetchResult,
} from './intent-autosave'

export type IntentSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type UseIntentAutosaveArgs = {
  projectId: string
  revision: number
  draft: Intent
  enabled: boolean
  onSaved: (project: StudioProject) => void
  onError: (message: string) => void
}

/**
 * Debounced Intent PATCH — sends only changed fields, serializes requests,
 * and treats no-op tool responses as soft success (same chip still selected).
 */
export const useIntentAutosave = ({
  projectId,
  revision,
  draft,
  enabled,
  onSaved,
  onError,
}: UseIntentAutosaveArgs) => {
  const [status, setStatus] = useState<IntentSaveStatus>('idle')
  const draftRef = useRef(draft)
  draftRef.current = draft
  const revisionRef = useRef(revision)
  revisionRef.current = revision
  const baselineRef = useRef<Intent | null>(null)
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const enqueueRef = useRef(createIntentAutosaveQueue())

  const resetBaseline = useCallback((next: Intent) => {
    baselineRef.current = next
    setStatus('idle')
  }, [])

  const fetchIntent = useCallback(
    async (input: {
      projectId: string
      expectedRevision: number
      patch: Partial<Intent>
    }): Promise<IntentAutosaveFetchResult> => {
      const response = await fetch(`/api/studio/projects/${input.projectId}/intent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: input.expectedRevision,
          ...input.patch,
        }),
      })
      const body = (await response.json()) as {
        error?: string
        project?: StudioProject
      }
      return { ok: response.ok, status: response.status, body }
    },
    [],
  )

  const saveNow = useCallback(
    async (nextDraft: Intent): Promise<StudioProject | null> => {
      const baseline = baselineRef.current
      if (!baseline) {
        baselineRef.current = nextDraft
        return null
      }
      const patch = intentPatchFromDraft(baseline, nextDraft)
      if (isEmptyIntentPatch(patch)) {
        setStatus('saved')
        return null
      }

      setStatus('saving')
      return enqueueRef.current(async () => {
        const outcome = await performIntentAutosave({
          projectId,
          getRevision: () => revisionRef.current,
          getDraft: () => draftRef.current,
          getBaseline: () => baselineRef.current,
          setBaseline: (intent) => {
            baselineRef.current = intent
          },
          setRevision: (next) => {
            revisionRef.current = next
          },
          fetchIntent,
        })

        if (outcome.kind === 'skipped_empty' || outcome.kind === 'skipped_noop') {
          setStatus('saved')
          return null
        }
        if (outcome.kind === 'conflict' || outcome.kind === 'error') {
          onErrorRef.current(outcome.message)
          setStatus('error')
          return null
        }
        setStatus('saved')
        onSavedRef.current(outcome.project)
        return outcome.project
      })
    },
    [fetchIntent, projectId],
  )

  const flush = useCallback(
    async (): Promise<StudioProject | null> => saveNow(draftRef.current),
    [saveNow],
  )

  useEffect(() => {
    revisionRef.current = revision
  }, [revision])

  useEffect(() => {
    if (!enabled) return
    if (baselineRef.current === null) {
      baselineRef.current = draft
      return
    }
    const patch = intentPatchFromDraft(baselineRef.current, draft)
    if (isEmptyIntentPatch(patch)) return

    setStatus((prev) => (prev === 'saving' ? prev : 'idle'))
    const timer = window.setTimeout(() => {
      void saveNow(draft)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [draft, enabled, saveNow])

  return { status, flush, resetBaseline }
}
