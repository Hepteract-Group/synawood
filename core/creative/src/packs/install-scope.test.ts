import { describe, expect, it } from 'vitest'
import { accountInstallBlobProductId, resolvePackInstallScope } from './install-scope'

describe('pack install scope (#954)', () => {
  it('defaults to This organization (product) and rejects a missing product', () => {
    const resolved = resolvePackInstallScope({
      productId: 'demo',
      userId: '11111111-1111-4111-8111-111111111111',
    })
    expect(resolved).toEqual({
      scope: 'product',
      productId: 'demo',
      userId: null,
      blobProductId: 'demo',
    })
    expect(() =>
      resolvePackInstallScope({
        productId: '  ',
        userId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow(/Product/)
  })

  it('binds My account to the user and a dedicated blob prefix', () => {
    const userId = '11111111-1111-4111-8111-111111111111'
    const resolved = resolvePackInstallScope({
      scope: 'account',
      productId: 'demo',
      userId,
    })
    expect(resolved.scope).toBe('account')
    expect(resolved.productId).toBeNull()
    expect(resolved.userId).toBe(userId)
    expect(resolved.blobProductId).toBe(accountInstallBlobProductId(userId))
    expect(resolved.blobProductId.startsWith('account:')).toBe(true)
    expect(() =>
      resolvePackInstallScope({ scope: 'account', productId: 'demo', userId: '  ' }),
    ).toThrow(/signed-in/)
  })
})
