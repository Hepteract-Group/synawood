'use client'

import type { ExtractedBrief } from '@synawood/creative/brief/extracted-brief'
import { useCallback, useEffect, useRef, useState } from 'react'

export type BriefSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type UseBriefAutosaveArgs = {
  projectId: string
  briefId: string | null
  draft: ExtractedBrief | null
  enabled: boolean
}

export const useBriefAutosave = ({ projectId, briefId, draft, enabled }: UseBriefAutosaveArgs) => {
  const [status, setStatus] = useState<BriefSaveStatus>('idle')
  const draftRef = useRef(draft)
  draftRef.current = draft
  const savedJsonRef = useRef<string | null>(null)
  const briefIdRef = useRef(briefId)
  briefIdRef.current = briefId

  const resetBaseline = useCallback((next: ExtractedBrief | null) => {
    savedJsonRef.current = next ? JSON.stringify(next) : null
    setStatus('idle')
  }, [])

  const saveNow = useCallback(
    async (brief: ExtractedBrief, id: string): Promise<void> => {
      setStatus('saving')
      const response = await fetch(`/api/studio/projects/${projectId}/extracted-briefs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setStatus('error')
        throw new Error(body.error ?? 'Failed to save brief edits')
      }
      savedJsonRef.current = JSON.stringify(brief)
      setStatus('saved')
    },
    [projectId],
  )

  const flush = useCallback(async (): Promise<void> => {
    const current = draftRef.current
    const id = briefIdRef.current
    if (!current || !id) return
    const json = JSON.stringify(current)
    if (json === savedJsonRef.current) return
    await saveNow(current, id)
  }, [saveNow])

  useEffect(() => {
    if (!enabled || !draft || !briefId) return
    const json = JSON.stringify(draft)
    if (savedJsonRef.current === null) {
      savedJsonRef.current = json
      return
    }
    if (json === savedJsonRef.current) return

    setStatus((prev) => (prev === 'saving' ? prev : 'idle'))
    const timer = window.setTimeout(() => {
      void saveNow(draft, briefId).catch(() => {
        /* status already error */
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [draft, briefId, enabled, saveNow])

  return { status, flush, resetBaseline }
}
