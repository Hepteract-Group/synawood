/** Active Product cookie — Product context after onboarding (#103). */

export const ACTIVE_PRODUCT_COOKIE = 'synawood-active-product'

export const readActiveProductIdFromDocument = (): string | null => {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ACTIVE_PRODUCT_COOKIE}=`))
  if (!match) return null
  const value = decodeURIComponent(match.split('=').slice(1).join('=').trim())
  return value || null
}

export const rememberActiveProductId = (productId: string): void => {
  document.cookie = `${ACTIVE_PRODUCT_COOKIE}=${encodeURIComponent(productId)}; Path=/; Max-Age=${
    60 * 60 * 24 * 400
  }; SameSite=Lax`
}

export const clearActiveProductId = (): void => {
  document.cookie = `${ACTIVE_PRODUCT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export const activeProductCookieHeader = (
  productId: string,
): { name: string; value: string; options: Record<string, unknown> } => ({
  name: ACTIVE_PRODUCT_COOKIE,
  value: productId,
  options: {
    path: '/',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 400,
  },
})
