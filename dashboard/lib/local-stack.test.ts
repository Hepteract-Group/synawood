import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(process.cwd(), '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('local Docker stack (#1368)', () => {
  it('joins dashboard, workers, supabase, and postiz on one network', () => {
    const up = read('scripts/local-up.ts')
    const compose = read('compose.yaml')
    const postiz = read('infra/postiz/docker-compose.synawood.yaml')
    expect(up).toMatch(/--network-id/)
    expect(up).toMatch(/synawood/)
    expect(up).toMatch(/infra\/postiz\/docker-compose.yaml/)
    expect(compose).toMatch(/Dockerfile.dashboard/)
    expect(compose).toMatch(/Dockerfile.workers/)
    expect(compose).toMatch(/STUDIO_EXTRACT_INLINE: 'false'/)
    expect(postiz).toMatch(/name: synawood/)
    expect(compose).not.toMatch(/synawood.com/)
  })

  it('hides host dashboard/node_modules from the Linux container (#1384)', () => {
    const compose = read('compose.yaml')
    const up = read('scripts/local-up.ts')
    expect(compose).toMatch(/\/app\/dashboard\/node_modules/)
    expect(up).toMatch(/127\.0\.0\.1:3000/)
  })

  it('keeps Docker build context off node_modules and .next (#1382)', () => {
    const ignore = read('.dockerignore')
    expect(ignore).toMatch(/^node_modules$/m)
    expect(ignore).toMatch(/dashboard\/\.next/)
    expect(ignore).toMatch(/^docs\/local$/m)
  })

  it('gives the dashboard container a server Supabase URL (#1387)', () => {
    const compose = read('compose.yaml')
    expect(compose).toMatch(/NEXT_PUBLIC_SUPABASE_URL: http:\/\/localhost:54341/)
    expect(compose).toMatch(/SUPABASE_URL: http:\/\/host\.docker\.internal:54341/)
  })
})
