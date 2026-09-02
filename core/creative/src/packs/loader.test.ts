import { describe, expect, it, vi } from 'vitest'
import { listInstalledPackSkills } from './loader'

const blobEnv = {
  connectionString: 'UseDevelopmentStorage=true',
  container: 'test',
  useLocalPrefix: true,
}

describe('listInstalledPackSkills', () => {
  it('skips revoked versions', async () => {
    const versionId = '11111111-1111-1111-1111-111111111111'
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'pack_installs') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ id: 'i1', pack_version_id: versionId, enabled: true }],
                    error: null,
                  }),
              }),
            }),
          }
        }
        if (table === 'pack_versions') {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    {
                      id: versionId,
                      pack_id: '22222222-2222-2222-2222-222222222222',
                      semver: '1.0.0',
                      blob_key: 'k',
                      checksum_sha256: 'a'.repeat(64),
                      signature: null,
                      manifest: {
                        id: 'hooks',
                        slug: 'hooks-first',
                        kind: 'skill',
                        semver: '1.0.0',
                        mosApiVersion: 1,
                        title: 'Hooks',
                        entries: ['SKILL.md'],
                        requiresConfirmSpend: true,
                      },
                      published_at: null,
                      created_at: '2026-01-01T00:00:00.000Z',
                    },
                  ],
                  error: null,
                }),
            }),
          }
        }
        if (table === 'pack_revocations') {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ pack_version_id: versionId }],
                  error: null,
                }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    const skills = await listInstalledPackSkills({
      supabase: supabase as never,
      blobEnv: blobEnv as never,
      productId: 'demo',
    })
    expect(skills).toEqual([])
  })

  it('fails closed when revocations query errors', async () => {
    const versionId = '11111111-1111-1111-1111-111111111111'
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'pack_installs') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ id: 'i1', pack_version_id: versionId, enabled: true }],
                    error: null,
                  }),
              }),
            }),
          }
        }
        if (table === 'pack_versions') {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    {
                      id: versionId,
                      pack_id: '22222222-2222-2222-2222-222222222222',
                      semver: '1.0.0',
                      blob_key: 'k',
                      checksum_sha256: 'a'.repeat(64),
                      signature: null,
                      manifest: {
                        id: 'hooks',
                        slug: 'hooks-first',
                        kind: 'skill',
                        semver: '1.0.0',
                        mosApiVersion: 1,
                        title: 'Hooks',
                        entries: ['SKILL.md'],
                        requiresConfirmSpend: true,
                      },
                      published_at: null,
                      created_at: '2026-01-01T00:00:00.000Z',
                    },
                  ],
                  error: null,
                }),
            }),
          }
        }
        if (table === 'pack_revocations') {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: null, error: { message: 'db down' } }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    }

    await expect(
      listInstalledPackSkills({
        supabase: supabase as never,
        blobEnv: blobEnv as never,
        productId: 'demo',
      }),
    ).rejects.toThrow(/revocations failed/)
  })
})
