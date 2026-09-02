import { z } from 'zod'

/** Persisted on products.brand_library — product-scoped, not project-owned. */
export const productBrandLibraryAssetSchema = z
  .object({
    assetId: z.string().uuid(),
    blobKey: z.string().min(1),
    contentType: z.string().min(1),
    label: z.string().optional(),
  })
  .strict()

export const productBrandLibrarySchema = z
  .object({
    version: z.literal(1),
    productId: z.string().min(1),
    displayName: z.string().min(1),
    defaultCta: z.string().min(1),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    captionBg: z.string().optional(),
    fontFamily: z.string().optional(),
    voiceId: z.string().optional(),
    mood: z.string().optional(),
    logoPrimary: productBrandLibraryAssetSchema,
    logoMono: productBrandLibraryAssetSchema.optional(),
    stills: z.array(productBrandLibraryAssetSchema).default([]),
    seededFromDiskAt: z.string().optional(),
  })
  .strict()

export type ProductBrandLibrary = z.infer<typeof productBrandLibrarySchema>
export type ProductBrandLibraryAsset = z.infer<typeof productBrandLibraryAssetSchema>
