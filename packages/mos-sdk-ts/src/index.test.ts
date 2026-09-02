import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createMosClient, mosBearerHeaders } from './index'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')) as {
  private?: boolean
  scripts?: Record<string, string>
  publishConfig?: unknown
}

describe('mos-sdk-ts stub (#282)', () => {
  it('stays private and does not wrap MCP tools', () => {
    expect(pkg.private).toBe(true)
    expect(pkg.publishConfig).toBeUndefined()
    expect(pkg.scripts?.publish).toBeUndefined()
    const index = readFileSync(join(here, 'index.ts'), 'utf8')
    expect(index).not.toMatch(/mcp:/)
    expect(index).toContain('Authorization')
  })

  it('calls GET /api/v1/health with a Bearer product key', async () => {
    const headers = mosBearerHeaders('mos_test')
    expect(headers).toEqual({ Authorization: 'Bearer mos_test' })

    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe('http://localhost:3000/api/v1/health')
      expect(init?.headers).toEqual({ Authorization: 'Bearer mos_test' })
      return new Response(JSON.stringify({ ok: true, productId: 'prod-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const client = createMosClient({
      baseUrl: 'http://localhost:3000/',
      apiKey: 'mos_test',
    })
    await expect(client.health(fetchImpl)).resolves.toEqual({ ok: true, productId: 'prod-1' })
  })

  it('throws when health is unauthorized', async () => {
    const client = createMosClient({ baseUrl: 'http://localhost:3000', apiKey: 'bad' })
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 401 })
    await expect(client.health(fetchImpl)).rejects.toThrow(/401/)
  })
})
