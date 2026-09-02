/** Product vs Account pack install scope (ADR-0080 / #954). */

export type PackInstallScope = 'product' | 'account'

export type ResolvedPackInstallScope =
  | { scope: 'product'; productId: string; userId: null; blobProductId: string }
  | { scope: 'account'; productId: null; userId: string; blobProductId: string }

export const accountInstallBlobProductId = (userId: string): string => `account:${userId}`

export const resolvePackInstallScope = (input: {
  scope?: PackInstallScope | string | null
  productId: string
  userId: string
}): ResolvedPackInstallScope => {
  const scope: PackInstallScope = input.scope === 'account' ? 'account' : 'product'
  if (scope === 'account') {
    const userId = input.userId.trim()
    if (!userId) throw new Error('My account installs need a signed-in user.')
    return {
      scope: 'account',
      productId: null,
      userId,
      blobProductId: accountInstallBlobProductId(userId),
    }
  }
  const productId = input.productId.trim()
  if (!productId) throw new Error('This organization install needs a Product.')
  return { scope: 'product', productId, userId: null, blobProductId: productId }
}
