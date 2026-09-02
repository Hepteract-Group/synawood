'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GenerationJobLineInput } from '@/lib/generation-progress-ui'

export type GenerationJobSummary = GenerationJobLineInput & {
  estimatedGbp: number | null
}

export { formatGenerationJobLine } from '@/lib/generation-progress-ui'

export const useProjectGenerationJobs = (projectId: string | null, enabled = true) => {
  const [jobs, setJobs] = useState<GenerationJobSummary[]>([])

  const load = useCallback(async () => {
    if (!projectId) return
    const response = await fetch(
      `/api/studio/projects/${encodeURIComponent(projectId)}/generation-jobs`,
      { credentials: 'same-origin' },
    )
    const body = (await response.json().catch(() => null)) as {
      jobs?: GenerationJobSummary[]
    } | null
    if (!response.ok) return
    setJobs(body?.jobs ?? [])
  }, [projectId])

  useEffect(() => {
    if (!enabled || !projectId) return
    void load()
    const timer = window.setInterval(() => void load(), 2500)
    return () => window.clearInterval(timer)
  }, [enabled, load, projectId])

  return { jobs, reload: load }
}

export const inFlightGenerationJobs = (jobs: GenerationJobSummary[]): GenerationJobSummary[] =>
  jobs.filter((job) => job.status === 'queued' || job.status === 'generating')

export const failedGenerationJobs = (jobs: GenerationJobSummary[]): GenerationJobSummary[] =>
  jobs.filter((job) => job.status === 'failed')
