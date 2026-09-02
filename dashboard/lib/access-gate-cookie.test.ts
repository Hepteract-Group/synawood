import { describe, expect, it } from 'vitest'
import {
  ACCESS_GATE_COOKIE,
  clearAccessGateCookieOptions,
  sealAccessGate,
  unsealAccessGate,
} from './access-gate-cookie'

describe('access gate cookie', () => {
  const secret = 'test-service-role-secret'
  const userId = '11111111-2222-3333-4444-555555555555'

  it('names the cookie for middleware', () => {
    expect(ACCESS_GATE_COOKIE).toBe('mos-access-gate')
  })

  it('clearAccessGateCookieOptions expires the gate cookie (#1171)', () => {
    const cleared = clearAccessGateCookieOptions()
    expect(cleared.name).toBe(ACCESS_GATE_COOKIE)
    expect(cleared.value).toBe('')
    expect(cleared.options.maxAge).toBe(0)
    expect(cleared.options.path).toBe('/')
  })

  it('round-trips membership count for the same user inside TTL', async () => {
    const now = 1_700_000_000_000
    const token = await sealAccessGate({
      userId,
      membershipCount: 3,
      allowed: true,
      secret,
      now,
    })
    expect(await unsealAccessGate(token, { userId, secret, now: now + 10_000 })).toEqual({
      membershipCount: 3,
      allowed: true,
      profileComplete: false,
    })
  })

  it('treats four-part cookies as unknown profile state', async () => {
    const now = 1_700_000_000_000
    const payload = `${userId}.2.1.${now + 90_000}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    let binary = ''
    for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte)
    const sig = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
    expect(await unsealAccessGate(`${payload}.${sig}`, { userId, secret, now })).toEqual({
      membershipCount: 2,
      allowed: true,
    })
  })

  it('rejects a token for a different user, a bad signature, or after expiry', async () => {
    const now = 1_700_000_000_000
    const token = await sealAccessGate({
      userId,
      membershipCount: 1,
      allowed: true,
      secret,
      now,
    })
    expect(
      await unsealAccessGate(token, { userId: 'other-user', secret, now: now + 1000 }),
    ).toBeNull()
    expect(await unsealAccessGate(`${token}x`, { userId, secret, now: now + 1000 })).toBeNull()
    expect(await unsealAccessGate(token, { userId, secret, now: now + 120_000 })).toBeNull()
  })
})
