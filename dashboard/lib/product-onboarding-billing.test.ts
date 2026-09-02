import { describe, expect, it } from 'vitest'
import { createProductAsOwner } from './product-onboarding'

const stubCreateClient = () => {
  const inserted: Record<string, Record<string, unknown>[]> = {
    products: [],
    product_members: [],
    product_billing: [],
    product_wallets: [],
    audit_events: [],
  }
  const client = {
    from: (table: string) => {
      const list = inserted[table] ?? []
      return {
        insert: (row: Record<string, unknown>) => {
          list.push(row)
          inserted[table] = list
          if (table === 'products') {
            return {
              select: () => ({
                single: async () => ({
                  data: { id: row.id, slug: row.slug, name: row.name },
                  error: null,
                }),
              }),
            }
          }
          return Promise.resolve({ error: null })
        },
        upsert: async (
          row: Record<string, unknown>,
          opts: { onConflict: string; ignoreDuplicates: boolean },
        ) => {
          if (opts.onConflict !== 'product_id' || !opts.ignoreDuplicates) {
            return { error: { message: 'expected ignoreDuplicates' } }
          }
          if (!list.some((existing) => existing.product_id === row.product_id)) {
            list.push(row)
            inserted[table] = list
          }
          return { error: null }
        },
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      }
    },
  }
  return { client, inserted }
}

describe('createProductAsOwner trial billing (#1034)', () => {
  it('inserts trial billing and a zero wallet for the new Product', async () => {
    const { client, inserted } = stubCreateClient()
    const product = await createProductAsOwner(client as never, {
      userId: 'user-1',
      name: 'Acme',
      slug: 'acme',
    })
    expect(product).toEqual({ id: 'acme', slug: 'acme', name: 'Acme' })
    expect(inserted.product_billing).toHaveLength(1)
    expect(inserted.product_wallets).toHaveLength(1)
    expect(inserted.product_billing[0]).toMatchObject({
      product_id: 'acme',
      plan_id: 'trial',
      seat_limit: 3,
    })
    expect(inserted.product_wallets[0]).toMatchObject({
      product_id: 'acme',
      balance_gbp: 0,
    })
    expect(inserted.audit_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          product_id: 'acme',
          actor_user_id: 'user-1',
          action: 'billing.org_created',
          payload: { slug: 'acme', name: 'Acme' },
        }),
      ]),
    )
  })
})
