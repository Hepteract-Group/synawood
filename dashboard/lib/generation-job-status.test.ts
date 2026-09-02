import { describe, expect, it } from 'vitest'
import { generationJobStatus } from './generation-job-status'

describe('generationJobStatus', () => {
  it('reads nested job.status from GET /api/studio/generation/[jobId]', () => {
    expect(generationJobStatus({ job: { status: 'ready' }, brief: null })).toBe('ready')
  })

  it('falls back to top-level status for older payloads', () => {
    expect(generationJobStatus({ status: 'failed' })).toBe('failed')
  })

  it('prefers nested job.status when both exist', () => {
    expect(generationJobStatus({ job: { status: 'generating' }, status: 'ready' })).toBe(
      'generating',
    )
  })

  it('returns undefined when status is missing (the MusicPanel recovery bug)', () => {
    expect(generationJobStatus({ job: { id: 'abc' }, brief: null })).toBeUndefined()
    expect(generationJobStatus({})).toBeUndefined()
    expect(generationJobStatus(null)).toBeUndefined()
  })
})
