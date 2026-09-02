import { describe, expect, it, vi } from 'vitest'
import { listAuditEvents, logAuditEvent } from './audit'

describe('logAuditEvent (#265)', () => {
  it('inserts product_id, actor, action, payload', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const supabase = { from: () => ({ insert }) } as never
    await logAuditEvent(supabase, {
      productId: 'demo',
      actorUserId: 'u1',
      action: 'invite.created',
      payload: { email: 'a@b.com' },
    })
    expect(insert).toHaveBeenCalledWith({
      product_id: 'demo',
      actor_user_id: 'u1',
      action: 'invite.created',
      payload: { email: 'a@b.com' },
    })
  })

  it('fails closed when insert errors', async () => {
    const insert = vi.fn(async () => ({ error: { message: 'rls' } }))
    const supabase = { from: () => ({ insert }) } as never
    await expect(
      logAuditEvent(supabase, { productId: 'demo', action: 'member.created' }),
    ).rejects.toThrow(/audit event/)
  })
})

describe('listAuditEvents (#269)', () => {
  it('returns newest rows for the Product', async () => {
    const limit = vi.fn(async () => ({
      data: [
        {
          id: 'e1',
          product_id: 'demo',
          actor_user_id: 'u1',
          action: 'invite.created',
          payload: { email: 'a@b.com' },
          created_at: '2026-08-22T00:00:00.000Z',
        },
      ],
      error: null,
    }))
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({ limit }),
          }),
        }),
      }),
    } as never
    const events = await listAuditEvents(supabase, { productId: 'demo' })
    expect(events).toEqual([
      {
        id: 'e1',
        productId: 'demo',
        actorUserId: 'u1',
        action: 'invite.created',
        payload: { email: 'a@b.com' },
        createdAt: '2026-08-22T00:00:00.000Z',
      },
    ])
    expect(limit).toHaveBeenCalledWith(50)
  })
})
