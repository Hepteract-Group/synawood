import { describe, expect, it, vi } from 'vitest'
import { syncPackRevocations } from './revocation'

describe('syncPackRevocations', () => {
  it('disables enabled installs for revoked versions', async () => {
    const versionId = '11111111-1111-4111-8111-111111111111'
    const updateEqEnabled = vi.fn(() => ({
      select: () =>
        Promise.resolve({
          data: [{ id: 'install-1' }],
          error: null,
        }),
    }))
    const updateIn = vi.fn(() => ({ eq: updateEqEnabled }))
    const updateEqProduct = vi.fn(() => ({ in: updateIn }))
    const update = vi.fn(() => ({ eq: updateEqProduct }))

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'pack_revocations') {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: '22222222-2222-4222-8222-222222222222',
                      pack_version_id: versionId,
                      reason: 'unsafe',
                      revoked_at: '2026-08-01T00:00:00.000Z',
                    },
                  ],
                  error: null,
                }),
            }),
          }
        }
        if (table === 'pack_installs') {
          return { update }
        }
        throw new Error(`unexpected ${table}`)
      }),
    }

    const result = await syncPackRevocations(supabase as never, { productId: 'demo' })
    expect(result.disabledInstallIds).toEqual(['install-1'])
    expect(result.cursor).toBe('2026-08-01T00:00:00.000Z')
    expect(result.applied).toHaveLength(1)
  })
})
