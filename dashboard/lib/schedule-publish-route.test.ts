import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

const readRoute = (relativeFromApp: string): string =>
  readFileSync(join(here, '../app/api/studio/publish', relativeFromApp), 'utf8')

describe('publish routes (#808)', () => {
  it('keeps POST /api/studio/publish on the manual adapter so Approve/prepare does not post', () => {
    const route = readRoute('route.ts')
    expect(route).toContain('createManualPublishAdapter')
    expect(route).not.toContain('createPostizPublishAdapter')
  })

  it('schedules through a live Postiz route that reads Blob and never uses mock', () => {
    const route = readRoute('schedule/route.ts')
    expect(route).toContain('createPostizPublishAdapter')
    expect(route).toContain('isPostizLiveConfigured')
    expect(route).toContain('getBlobBytes')
    expect(route).toContain('503')
    expect(route).not.toMatch(/POSTIZ_ADAPTER\s*=\s*['"]mock['"]/)
    expect(route).toContain('scheduledAt')
  })
})
