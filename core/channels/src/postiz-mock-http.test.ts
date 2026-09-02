import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockPostizFetch } from './postiz-mock-http'
import { createPostizPublishAdapter } from './postiz-publish'

describe('createMockPostizFetch (#803)', () => {
  it('answers upload, create, and delete in memory and never forwards', async () => {
    const { fetchImpl, requests } = createMockPostizFetch()
    const upload = await fetchImpl('https://api.postiz.com/public/v1/upload', { method: 'POST' })
    const created = await fetchImpl('https://api.postiz.com/public/v1/posts', { method: 'POST' })
    const deleted = await fetchImpl('https://api.postiz.com/public/v1/posts/pz_1', {
      method: 'DELETE',
    })
    const listed = await fetchImpl(
      'https://api.postiz.com/public/v1/posts?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T00:00:00.000Z',
    )
    expect(upload.ok).toBe(true)
    expect(await created.json()).toEqual([{ postId: 'pz_1', integration: 'int_li' }])
    expect(deleted.ok).toBe(true)
    expect(await listed.json()).toEqual({ posts: [] })
    expect(requests).toHaveLength(4)
    await expect(fetchImpl('https://api.postiz.com/public/v1/integrations')).rejects.toThrow(
      /no handler/,
    )
  })

  it('does not call global fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('live fetch must not run in CI')
    })
    const { fetchImpl } = createMockPostizFetch()
    await fetchImpl('https://api.postiz.com/public/v1/posts', { method: 'POST' })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('leaves the live adapter constructable behind env', () => {
    expect(() =>
      createPostizPublishAdapter({
        POSTIZ_ADAPTER: 'live',
        POSTIZ_BASE_URL: 'https://api.postiz.com/public/v1',
        POSTIZ_API_KEY: 'pos_test',
      }),
    ).not.toThrow()
  })

  it('is injected by adapter schedule and cancel tests', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const schedule = readFileSync(join(here, 'postiz-publish.schedule.test.ts'), 'utf8')
    const cancel = readFileSync(join(here, 'postiz-publish.cancel.test.ts'), 'utf8')
    const status = readFileSync(join(here, 'postiz-publish.status.test.ts'), 'utf8')
    expect(schedule).toContain('createMockPostizFetch')
    expect(cancel).toContain('createMockPostizFetch')
    expect(status).toContain('createMockPostizFetch')
  })
})
