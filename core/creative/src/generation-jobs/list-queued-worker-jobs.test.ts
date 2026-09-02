import { describe, expect, it, vi } from 'vitest'
import { listQueuedExtractJobs, listQueuedRenderJobs } from './list-queued-worker-jobs'

describe('listQueuedExtractJobs (#1368)', () => {
  it('asks for queued extract jobs oldest first', async () => {
    const limit = vi.fn(async () => ({
      data: [{ id: 'job-1', role: 'extract', status: 'queued' }],
      error: null,
    }))
    const order = vi.fn(() => ({ limit }))
    const eqStatus = vi.fn(() => ({ order }))
    const eqRole = vi.fn(() => ({ eq: eqStatus }))
    const select = vi.fn(() => ({ eq: eqRole }))
    const from = vi.fn(() => ({ select }))
    const jobs = await listQueuedExtractJobs({ from } as never, 5)
    expect(from).toHaveBeenCalledWith('generation_jobs')
    expect(eqRole).toHaveBeenCalledWith('role', 'extract')
    expect(eqStatus).toHaveBeenCalledWith('status', 'queued')
    expect(jobs).toHaveLength(1)
  })
})

describe('listQueuedRenderJobs (#1368)', () => {
  it('asks for queued render jobs oldest first', async () => {
    const limit = vi.fn(async () => ({ data: [{ id: 'render-1', status: 'queued' }], error: null }))
    const order = vi.fn(() => ({ limit }))
    const eqStatus = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq: eqStatus }))
    const from = vi.fn(() => ({ select }))
    const jobs = await listQueuedRenderJobs({ from } as never)
    expect(from).toHaveBeenCalledWith('render_jobs')
    expect(eqStatus).toHaveBeenCalledWith('status', 'queued')
    expect(jobs[0]?.id).toBe('render-1')
  })
})
