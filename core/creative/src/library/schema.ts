/** Product overlay library DTOs (ADR-0059 / #715). Client-safe. */

import { z } from 'zod'

export const libraryKindSchema = z.enum([
  'sticker',
  'filter',
  'effect',
  'text_preset',
  'caption_preset',
])
export type LibraryKind = z.infer<typeof libraryKindSchema>

export const librarySourceSchema = z.enum(['first-party', 'generated', 'imported'])
export type LibrarySource = z.infer<typeof librarySourceSchema>

export const libraryLicenseStatusSchema = z.enum([
  'first-party',
  'generated',
  'unknown',
  'cleared',
  'blocked',
])
export type LibraryLicenseStatus = z.infer<typeof libraryLicenseStatusSchema>

export const libraryCreatedBySchema = z.enum(['first-party', 'user', 'agent', 'import'])
export type LibraryCreatedBy = z.infer<typeof libraryCreatedBySchema>

export const libraryItemSchema = z
  .object({
    id: z.string().min(1).max(80),
    productId: z.string().min(1).nullable(),
    kind: libraryKindSchema,
    label: z.string().min(1).max(80),
    source: librarySourceSchema,
    licenseStatus: libraryLicenseStatusSchema,
    commercialUseAllowed: z.boolean(),
    recipe: z.record(z.string(), z.unknown()),
    blobKey: z.string().min(1).nullable(),
    createdBy: libraryCreatedBySchema,
    createdAt: z.string().datetime().nullable(),
  })
  .strict()

export type LibraryItem = z.infer<typeof libraryItemSchema>

export const parseLibraryItem = (input: unknown): LibraryItem => libraryItemSchema.parse(input)

const toIsoDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${value}`)
  }
  return date.toISOString()
}

export const libraryItemFromRow = (row: {
  id: string
  product_id: string
  kind: string
  label: string
  source: string
  license_status: string
  commercial_use_allowed: boolean
  recipe: Record<string, unknown> | null
  blob_key: string | null
  created_by: string
  created_at: string
}): LibraryItem =>
  parseLibraryItem({
    id: row.id,
    productId: row.product_id,
    kind: row.kind,
    label: row.label,
    source: row.source,
    licenseStatus: row.license_status,
    commercialUseAllowed: row.commercial_use_allowed,
    recipe: row.recipe ?? {},
    blobKey: row.blob_key,
    createdBy: row.created_by,
    createdAt: toIsoDateTime(row.created_at),
  })

export const firstPartyLibraryItem = (input: {
  id: string
  kind: LibraryKind
  label: string
  recipe: Record<string, unknown>
}): LibraryItem =>
  parseLibraryItem({
    id: input.id,
    productId: null,
    kind: input.kind,
    label: input.label,
    source: 'first-party',
    licenseStatus: 'first-party',
    commercialUseAllowed: true,
    recipe: input.recipe,
    blobKey: null,
    createdBy: 'first-party',
    createdAt: null,
  })
