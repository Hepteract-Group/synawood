/** Product Catalog DTOs (ADR-0044 / #107). Distinct from the Asset Library. */

import { z } from 'zod'

export const catalogItemSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    summary: z.string().max(2000).default(''),
    claimBounds: z.array(z.string().max(160)).max(24).default([]),
    forbiddenClaims: z.array(z.string().max(160)).max(24).default([]),
  })
  .strict()

export type CatalogItem = z.infer<typeof catalogItemSchema>

export const productCatalogSchema = z
  .object({
    productId: z.string().min(1),
    items: z.array(catalogItemSchema).max(80).default([]),
  })
  .strict()

export type ProductCatalog = z.infer<typeof productCatalogSchema>

export const emptyProductCatalog = (productId: string): ProductCatalog =>
  productCatalogSchema.parse({ productId, items: [] })

export const parseProductCatalog = (input: unknown, productId: string): ProductCatalog => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return productCatalogSchema.parse({ ...(input as Record<string, unknown>), productId })
  }
  return emptyProductCatalog(productId)
}
