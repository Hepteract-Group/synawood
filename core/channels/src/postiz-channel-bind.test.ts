import { describe, expect, it } from 'vitest'
import { integrationsForOrganicChannel } from './organic-postiz-channel'
import { MOCK_POSTIZ_INTEGRATIONS } from './postiz-channel-bind.fixtures'
import {
  ACCOUNT_NOT_CONNECTED_COPY,
  ADS_POSTIZ_BIND_COPY,
  bindProductChannelIntegration,
  channelIntegrationsPayload,
  isChannelBindError,
  isMissingChannelIntegrationsSchema,
  isPostizLiveConfigured,
  isUniqueAccountConstraint,
  listPostizIntegrations,
  listProductChannelIntegrations,
  postizAppUrlFromApiRoot,
  unbindProductChannelIntegration,
} from './postiz-channel-bind'

type Row = Record<string, unknown>

const mockSupabase = (store: { rows: Row[]; upsertError?: { message: string } }) => {
  const from = () => {
    let mode: 'select' | 'upsert' | 'delete' = 'select'
    let payload: Row | undefined
    const filters: Record<string, string> = {}
    const match = () =>
      store.rows.filter((row) =>
        Object.entries(filters).every(([column, value]) => String(row[column]) === String(value)),
      )
    const run = async () => {
      if (mode === 'upsert' && payload) {
        if (store.upsertError) return { data: null, error: store.upsertError }
        const idx = store.rows.findIndex(
          (row) => row.product_id === payload?.product_id && row.channel === payload?.channel,
        )
        const row = {
          id: idx >= 0 ? store.rows[idx]?.id : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          created_at: '2026-08-26T00:00:00.000Z',
          updated_at: '2026-08-26T00:00:00.000Z',
          ...payload,
        }
        if (idx >= 0) store.rows[idx] = { ...store.rows[idx], ...row }
        else store.rows.push(row)
        return { data: row, error: null }
      }
      if (mode === 'delete') {
        const keep = new Set(match())
        store.rows = store.rows.filter((row) => !keep.has(row))
        return { data: null, error: null }
      }
      return { data: match(), error: null }
    }
    const builder: Record<string, unknown> = {
      select: () => builder,
      upsert: (next: Row) => {
        mode = 'upsert'
        payload = next
        return builder
      },
      delete: () => {
        mode = 'delete'
        return builder
      },
      eq: (column: string, value: string) => {
        filters[column] = value
        return builder
      },
      order: () => builder,
      single: async () => {
        const result = await run()
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data
        return { data, error: result.error }
      },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        run().then(resolve, reject),
    }
    return builder
  }
  return { from }
}

describe('Postiz channel bind (#798)', () => {
  const demo = { integrations: MOCK_POSTIZ_INTEGRATIONS }

  it('returns no Postiz accounts on the product path', async () => {
    expect(await listPostizIntegrations({ env: {} })).toEqual([])
    expect(isPostizLiveConfigured({})).toBe(false)
    expect(
      isPostizLiveConfigured({
        POSTIZ_ADAPTER: 'live',
        POSTIZ_BASE_URL: 'https://example.invalid',
        POSTIZ_API_KEY: 'k',
      }),
    ).toBe(true)
  })

  it('maps a live GET /integrations body and fails closed', async () => {
    const liveEnv = {
      POSTIZ_ADAPTER: 'live',
      POSTIZ_BASE_URL: 'https://mos-postiz.example/api/public/v1',
      POSTIZ_API_KEY: 'k',
    }
    const fetchImpl: typeof fetch = async (input) => {
      expect(String(input)).toBe('https://mos-postiz.example/api/public/v1/integrations')
      return new Response(
        JSON.stringify([
          { id: 'int_x', name: 'Founder', identifier: 'x', disabled: false },
          { id: 'int_fb', name: 'Page', identifier: 'facebook', disabled: false },
          { id: 'int_off', name: 'Old X', identifier: 'x', disabled: true },
        ]),
        { status: 200 },
      )
    }
    expect(await listPostizIntegrations({ env: liveEnv, fetchImpl })).toEqual([
      { id: 'int_x', name: 'Founder', provider: 'x' },
    ])
    expect(
      await listPostizIntegrations({
        env: liveEnv,
        fetchImpl: async () => new Response('nope', { status: 500 }),
      }),
    ).toEqual([])
  })

  it('turns the Public API root into the Postiz app URL', () => {
    expect(postizAppUrlFromApiRoot('https://mos-postiz.fly.dev/api/public/v1')).toBe(
      'https://mos-postiz.fly.dev',
    )
    expect(postizAppUrlFromApiRoot('https://api.postiz.com/public/v1')).toBe(
      'https://platform.postiz.com',
    )
    expect(postizAppUrlFromApiRoot('')).toBeNull()
  })

  it('does not export fixture account names from the product barrel', async () => {
    const barrel = await import('./index')
    expect(barrel).not.toHaveProperty('MOCK_POSTIZ_INTEGRATIONS')
  })

  it('binds an organic channel and rejects ads with tagged copy', async () => {
    const store = { rows: [] as Row[] }
    const supabase = mockSupabase(store) as never
    const bound = await bindProductChannelIntegration({
      supabase,
      productId: 'demo',
      channel: 'x_founder',
      postizIntegrationId: 'int_x_demo',
      ...demo,
    })
    expect(bound.channel).toBe('x_founder')
    expect(bound.postizIntegrationId).toBe('int_x_demo')
    expect(store.rows[0]?.postiz_integration_id).toBe('int_x_demo')

    await expect(
      bindProductChannelIntegration({
        supabase,
        productId: 'demo',
        channel: 'google_search_ads',
        postizIntegrationId: 'int_x_demo',
      }),
    ).rejects.toSatisfy(
      (error) => isChannelBindError(error) && error.message === ADS_POSTIZ_BIND_COPY,
    )

    await expect(
      bindProductChannelIntegration({
        supabase,
        productId: 'demo',
        channel: 'blog_seo',
        postizIntegrationId: 'int_x_demo',
      }),
    ).rejects.toSatisfy(
      (error) => isChannelBindError(error) && /cannot use Postiz/.test(error.message),
    )
  })

  it('validates against the injected integration list, not the mock constant', async () => {
    const store = { rows: [] as Row[] }
    const supabase = mockSupabase(store) as never
    const live = { id: 'int_live_x', name: 'Live X', provider: 'x' as const }
    const bound = await bindProductChannelIntegration({
      supabase,
      productId: 'demo',
      channel: 'x_founder',
      postizIntegrationId: live.id,
      integrations: [live],
    })
    expect(bound.postizIntegrationId).toBe('int_live_x')
    await expect(
      bindProductChannelIntegration({
        supabase,
        productId: 'demo',
        channel: 'x_founder',
        postizIntegrationId: 'int_x_demo',
        integrations: [live],
      }),
    ).rejects.toThrow(ACCOUNT_NOT_CONNECTED_COPY)
  })

  it('rejects a LinkedIn account on X and the same account on two channels', async () => {
    const store = { rows: [] as Row[] }
    const supabase = mockSupabase(store) as never
    await expect(
      bindProductChannelIntegration({
        supabase,
        productId: 'demo',
        channel: 'x_founder',
        postizIntegrationId: 'int_li_demo',
        ...demo,
      }),
    ).rejects.toThrow(/matching account/)

    store.rows = [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        product_id: 'demo',
        channel: 'x_founder',
        postiz_integration_id: 'int_tt_demo',
        created_at: '2026-08-26T00:00:00.000Z',
        updated_at: '2026-08-26T00:00:00.000Z',
      },
    ]
    await expect(
      bindProductChannelIntegration({
        supabase,
        productId: 'demo',
        channel: 'tiktok_organic',
        postizIntegrationId: 'int_tt_demo',
        ...demo,
      }),
    ).rejects.toThrow(/already bound to X/)
  })

  it('filters picker options by provider and already-bound accounts', () => {
    const bindings = [
      {
        channel: 'x_founder' as const,
        postizIntegrationId: 'int_x_demo',
      },
    ]
    const forX = integrationsForOrganicChannel('x_founder', MOCK_POSTIZ_INTEGRATIONS, bindings)
    expect(forX.map((row) => row.id)).toEqual(['int_x_demo'])
    const forTikTok = integrationsForOrganicChannel(
      'tiktok_organic',
      MOCK_POSTIZ_INTEGRATIONS,
      bindings,
    )
    expect(forTikTok.map((row) => row.id)).toEqual(['int_tt_demo'])
  })

  it('uses injected bindings instead of re-listing', async () => {
    const store = { rows: [] as Row[] }
    const supabase = mockSupabase(store) as never
    const existing = [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        productId: 'demo',
        channel: 'x_founder' as const,
        postizIntegrationId: 'int_tt_demo',
        createdAt: '2026-08-26T00:00:00.000Z',
        updatedAt: '2026-08-26T00:00:00.000Z',
      },
    ]
    await expect(
      bindProductChannelIntegration({
        supabase,
        productId: 'demo',
        channel: 'tiktok_organic',
        postizIntegrationId: 'int_tt_demo',
        ...demo,
        bindings: existing,
      }),
    ).rejects.toThrow(/already bound to X/)
    expect(store.rows).toEqual([])
  })

  it('maps a unique-account constraint to the already-bound copy', async () => {
    const store = {
      rows: [
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          product_id: 'demo',
          channel: 'x_founder',
          postiz_integration_id: 'int_tt_demo',
          created_at: '2026-08-26T00:00:00.000Z',
          updated_at: '2026-08-26T00:00:00.000Z',
        },
      ] as Row[],
      upsertError: {
        message:
          '23505 duplicate key value violates unique constraint "product_channel_integrations_product_integration_key"',
      },
    }
    const supabase = mockSupabase(store) as never
    expect(isUniqueAccountConstraint(store.upsertError.message)).toBe(true)
    await expect(
      bindProductChannelIntegration({
        supabase,
        productId: 'demo',
        channel: 'tiktok_organic',
        postizIntegrationId: 'int_tt_demo',
        ...demo,
        bindings: [],
      }),
    ).rejects.toSatisfy(
      (error) => isChannelBindError(error) && /already bound to X/.test(error.message),
    )
  })

  it('treats only missing-relation errors as this table missing', () => {
    expect(
      isMissingChannelIntegrationsSchema('relation "product_channel_integrations" does not exist'),
    ).toBe(true)
    expect(
      isMissingChannelIntegrationsSchema(
        '42P01: relation "product_channel_integrations" does not exist',
      ),
    ).toBe(true)
    expect(
      isMissingChannelIntegrationsSchema(
        "Could not find the table 'public.product_channel_integrations' in the schema cache",
      ),
    ).toBe(true)
    expect(
      isMissingChannelIntegrationsSchema(
        'column "postiz_integration_id" of relation "product_channel_integrations" does not exist',
      ),
    ).toBe(false)
    expect(isMissingChannelIntegrationsSchema('Could not query the schema cache')).toBe(false)
    expect(
      isMissingChannelIntegrationsSchema(
        'new row violates row-level security policy for table "product_channel_integrations"',
      ),
    ).toBe(false)
    expect(
      isMissingChannelIntegrationsSchema(
        'duplicate key value violates unique constraint "product_channel_integrations_product_integration_key"',
      ),
    ).toBe(false)
  })

  it('builds the settings payload without a second list', () => {
    const payload = channelIntegrationsPayload({
      integrations: MOCK_POSTIZ_INTEGRATIONS,
      bindings: [],
      canEdit: true,
      postizConfigured: false,
    })
    expect(payload.unboundChannels).toEqual(['x_founder', 'linkedin_founder', 'tiktok_organic'])
    expect(payload.postizConfigured).toBe(false)
    expect(payload.postizAppUrl).toBeNull()
    expect(payload.schemaMissing).toBeUndefined()
  })

  it('lists and unbinds Product-scoped maps', async () => {
    const store = { rows: [] as Row[] }
    const supabase = mockSupabase(store) as never
    await bindProductChannelIntegration({
      supabase,
      productId: 'demo',
      channel: 'linkedin_founder',
      postizIntegrationId: 'int_li_demo',
      ...demo,
    })
    const listed = await listProductChannelIntegrations(supabase, 'demo')
    expect(listed).toHaveLength(1)
    expect(listed[0]?.channel).toBe('linkedin_founder')

    await unbindProductChannelIntegration({
      supabase,
      productId: 'demo',
      channel: 'linkedin_founder',
    })
    expect(await listProductChannelIntegrations(supabase, 'demo')).toEqual([])
  })
})
