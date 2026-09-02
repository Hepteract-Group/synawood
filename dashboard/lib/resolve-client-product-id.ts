'use client'

import { readActiveProductIdFromDocument } from './active-product-cookie'

/** Active Product id for client fetches. Empty → caller should send user to onboarding. */
export const resolveClientProductId = (): string | null => readActiveProductIdFromDocument()

/** Cookie wins only if this user still belongs to that Product. Else first membership. */
export const pickActiveProductId = (
  memberships: Array<{ productId: string }>,
  cookieId: string | null,
): string | null => {
  if (cookieId && memberships.some((row) => row.productId === cookieId)) return cookieId
  return memberships[0]?.productId ?? null
}
