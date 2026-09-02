/** Agent Marketplace pack DTOs (ADR-0039 / #285). */

import { z } from 'zod'

export const packKindSchema = z.enum(['skill', 'style'])
export type PackKind = z.infer<typeof packKindSchema>

export const packCatalogStatusSchema = z.enum(['draft', 'queued', 'published', 'revoked'])
export type PackCatalogStatus = z.infer<typeof packCatalogStatusSchema>

export const packSubmissionStatusSchema = z.enum(['queued', 'approved', 'rejected'])
export type PackSubmissionStatus = z.infer<typeof packSubmissionStatusSchema>

export const packManifestSchema = z
  .object({
    id: z.string().min(1).max(80),
    slug: z.string().min(1).max(80),
    kind: packKindSchema,
    semver: z.string().min(1).max(32),
    mosApiVersion: z.number().int().positive().default(1),
    title: z.string().min(1).max(120),
    summary: z.string().max(2000).optional(),
    entries: z.array(z.string().min(1)).min(1).max(64),
    /** Tool names the pack may hint — never implies silent spend. */
    hintedTools: z.array(z.string().min(1)).max(64).optional(),
    requiresConfirmSpend: z.boolean().default(true),
  })
  .strict()

export type PackManifest = z.infer<typeof packManifestSchema>

export const packCatalogSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    kind: packKindSchema,
    title: z.string().min(1),
    summary: z.string(),
    publisher: z.string().min(1),
    status: packCatalogStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export type PackCatalog = z.infer<typeof packCatalogSchema>

export const packVersionSchema = z
  .object({
    id: z.string().uuid(),
    packId: z.string().uuid(),
    semver: z.string().min(1),
    blobKey: z.string().min(1),
    checksumSha256: z.string().min(32),
    signature: z.string().nullable(),
    manifest: packManifestSchema,
    publishedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict()

export type PackVersion = z.infer<typeof packVersionSchema>

export const packInstallSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1).nullable(),
    userId: z.string().uuid().nullable(),
    packVersionId: z.string().uuid(),
    enabled: z.boolean(),
    installedAt: z.string(),
    disabledAt: z.string().nullable(),
  })
  .strict()
  .refine(
    (row) =>
      (row.productId !== null && row.userId === null) ||
      (row.productId === null && row.userId !== null),
    { message: 'Install must be Product-scoped or Account-scoped, not both.' },
  )

export type PackInstall = z.infer<typeof packInstallSchema>

export const packRevocationSchema = z
  .object({
    id: z.string().uuid(),
    packVersionId: z.string().uuid(),
    reason: z.string(),
    revokedAt: z.string(),
  })
  .strict()

export type PackRevocation = z.infer<typeof packRevocationSchema>

export const packSubmissionSchema = z
  .object({
    id: z.string().uuid(),
    packId: z.string().uuid().nullable(),
    slug: z.string().min(1),
    kind: packKindSchema,
    title: z.string().min(1),
    blobKey: z.string().min(1),
    checksumSha256: z.string().min(32),
    signature: z.string().nullable(),
    manifest: packManifestSchema,
    status: packSubmissionStatusSchema,
    submittedBy: z.string().uuid().nullable(),
    curatorNote: z.string().nullable(),
    createdAt: z.string(),
    reviewedAt: z.string().nullable(),
  })
  .strict()

export type PackSubmission = z.infer<typeof packSubmissionSchema>

export const mapPackCatalogRow = (row: Record<string, unknown>): PackCatalog =>
  packCatalogSchema.parse({
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    summary: row.summary ?? '',
    publisher: row.publisher,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })

export const mapPackVersionRow = (row: Record<string, unknown>): PackVersion =>
  packVersionSchema.parse({
    id: row.id,
    packId: row.pack_id,
    semver: row.semver,
    blobKey: row.blob_key,
    checksumSha256: row.checksum_sha256,
    signature: row.signature ?? null,
    manifest: row.manifest,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
  })

export const mapPackInstallRow = (row: Record<string, unknown>): PackInstall =>
  packInstallSchema.parse({
    id: row.id,
    productId: typeof row.product_id === 'string' && row.product_id ? row.product_id : null,
    userId: typeof row.user_id === 'string' && row.user_id ? row.user_id : null,
    packVersionId: row.pack_version_id,
    enabled: row.enabled,
    installedAt: row.installed_at,
    disabledAt: row.disabled_at ?? null,
  })

export const mapPackRevocationRow = (row: Record<string, unknown>): PackRevocation =>
  packRevocationSchema.parse({
    id: row.id,
    packVersionId: row.pack_version_id,
    reason: row.reason ?? '',
    revokedAt: row.revoked_at,
  })

export const mapPackSubmissionRow = (row: Record<string, unknown>): PackSubmission =>
  packSubmissionSchema.parse({
    id: row.id,
    packId: row.pack_id ?? null,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    blobKey: row.blob_key,
    checksumSha256: row.checksum_sha256,
    signature: row.signature ?? null,
    manifest: row.manifest,
    status: row.status,
    submittedBy: row.submitted_by ?? null,
    curatorNote: row.curator_note ?? null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
  })
