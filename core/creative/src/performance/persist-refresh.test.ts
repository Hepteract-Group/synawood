import { describe, expect, it, vi } from 'vitest'
import { insertManualOutcome, refreshCreativePerformance } from './persist'

const PUBLISH_ID = '11111111-1111-4111-8111-111111111111'
const FINAL_ID = '22222222-2222-4222-8222-222222222222'
const PROJECT_ID = '33333333-3333-4333-8333-333333333333'
const OUTCOME_ID = '44444444-4444-4444-8444-444444444444'

const attributedClient = (rpcError: { message: string } | null) => {
  const from = (table: string) => {
    if (table === 'publish_records') {
      return {
        select: () => ({
          eq: async () => ({
            data: [
              {
                id: PUBLISH_ID,
                final_asset_id: FINAL_ID,
                external_url: 'https://x.com/p/1',
              },
            ],
            error: null,
          }),
        }),
      }
    }
    if (table === 'final_assets') {
      return {
        select: () => ({
          in: async () => ({
            data: [{ id: FINAL_ID, project_id: PROJECT_ID }],
            error: null,
          }),
        }),
      }
    }
    if (table === 'outcomes') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: OUTCOME_ID }, error: null }),
          }),
        }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  }
  return {
    from,
    rpc: vi.fn(async () => ({ error: rpcError })),
  }
}

describe('refresh_creative_performance after outcome save (#689)', () => {
  it('returns null when the RPC succeeds', async () => {
    const supabase = { rpc: async () => ({ error: null }) }
    await expect(refreshCreativePerformance(supabase as never)).resolves.toBeNull()
  })

  it('returns a warning and does not throw when the RPC fails', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const supabase = { rpc: async () => ({ error: { message: 'cannot refresh' } }) }
    const warning = await refreshCreativePerformance(supabase as never)
    expect(warning).toMatch(/Outcome saved, but the performance table did not refresh/)
    expect(warning).toMatch(/cannot refresh/)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('keeps the outcome save when refresh fails', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const supabase = attributedClient({ message: 'cannot refresh' })
    const result = await insertManualOutcome(supabase as never, 'demo', {
      metric: 'views',
      value: 12,
      externalUrl: 'https://x.com/p/1',
    })
    expect(result.attributed).toBe(true)
    expect(result.outcomeId).toBe(OUTCOME_ID)
    expect(result.refreshWarning).toMatch(/cannot refresh/)
    expect(supabase.rpc).toHaveBeenCalledWith('refresh_creative_performance')
    warn.mockRestore()
  })
})
