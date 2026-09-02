/** Catalog / install / curator helpers for Agent Marketplace HTTP (#291). */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlobEnv } from '../persistence/blob'
import { installPackVersion } from './install'
import { type PackInstallScope } from './install-scope'
import {
  mapPackCatalogRow,
  mapPackInstallRow,
  mapPackSubmissionRow,
  mapPackVersionRow,
  packManifestSchema,
  type PackCatalog,
  type PackInstall,
  type PackManifest,
  type PackSubmission,
  type PackVersion,
} from './schema'

export type CatalogListing = {
  pack: PackCatalog
  latestVersion: PackVersion | null
}

export const allowUnsignedPacksFromEnv = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.ALLOW_UNSIGNED_PACKS === 'true' || env.NODE_ENV === 'test' || env.NODE_ENV === 'development'

export const listPublishedPacks = async (
  supabase: SupabaseClient,
  input?: { kind?: 'skill' | 'style' },
): Promise<CatalogListing[]> => {
  let query = supabase.from('pack_catalog').select('*').eq('status', 'published').order('title')
  if (input?.kind) query = query.eq('kind', input.kind)
  const { data: packs, error } = await query
  if (error) throw new Error(`List pack catalog failed: ${error.message}`)
  if (!packs?.length) return []

  const ids = packs.map((row) => row.id as string)
  const { data: versions, error: versionError } = await supabase
    .from('pack_versions')
    .select('*')
    .in('pack_id', ids)
    .order('created_at', { ascending: false })
  if (versionError) throw new Error(`List pack versions failed: ${versionError.message}`)

  const latestByPack = new Map<string, PackVersion>()
  for (const row of versions ?? []) {
    const version = mapPackVersionRow(row)
    if (!latestByPack.has(version.packId)) latestByPack.set(version.packId, version)
  }

  return packs.map((row) => {
    const pack = mapPackCatalogRow(row)
    return { pack, latestVersion: latestByPack.get(pack.id) ?? null }
  })
}

export const listProductInstalls = async (
  supabase: SupabaseClient,
  productId: string,
  userId?: string,
): Promise<Array<{ install: PackInstall; version: PackVersion; pack: PackCatalog }>> => {
  const productRows = await supabase
    .from('pack_installs')
    .select('*')
    .eq('product_id', productId)
    .order('installed_at', { ascending: false })
  if (productRows.error) throw new Error(`List pack installs failed: ${productRows.error.message}`)
  const accountRows = userId
    ? await supabase
        .from('pack_installs')
        .select('*')
        .eq('user_id', userId)
        .order('installed_at', { ascending: false })
    : { data: [], error: null }
  if (accountRows.error) throw new Error(`List pack installs failed: ${accountRows.error.message}`)
  const installs = [...(productRows.data ?? []), ...(accountRows.data ?? [])]
  if (!installs?.length) return []

  const versionIds = installs.map((row) => row.pack_version_id as string)
  const { data: versions, error: versionError } = await supabase
    .from('pack_versions')
    .select('*')
    .in('id', versionIds)
  if (versionError) throw new Error(`List pack versions failed: ${versionError.message}`)
  const versionById = new Map(
    (versions ?? []).map((row) => {
      const version = mapPackVersionRow(row)
      return [version.id, version] as const
    }),
  )

  const packIds = [...new Set([...(versions ?? [])].map((row) => row.pack_id as string))]
  const { data: packs, error: packError } = await supabase
    .from('pack_catalog')
    .select('*')
    .in('id', packIds)
  if (packError) throw new Error(`List pack catalog failed: ${packError.message}`)
  const packById = new Map(
    (packs ?? []).map((row) => {
      const pack = mapPackCatalogRow(row)
      return [pack.id, pack] as const
    }),
  )

  return installs.flatMap((row) => {
    const install = mapPackInstallRow(row)
    const version = versionById.get(install.packVersionId)
    if (!version) return []
    const pack = packById.get(version.packId)
    if (!pack) return []
    return [{ install, version, pack }]
  })
}

export const setPackInstallEnabled = async (
  supabase: SupabaseClient,
  input: { productId: string; userId: string; installId: string; enabled: boolean },
): Promise<PackInstall> => {
  const { data: row, error: loadError } = await supabase
    .from('pack_installs')
    .select('*')
    .eq('id', input.installId)
    .maybeSingle()
  if (loadError) throw new Error(`Load pack install failed: ${loadError.message}`)
  if (!row) throw new Error('Pack install not found')
  const allowed = row.product_id === input.productId || row.user_id === input.userId
  if (!allowed) throw new Error('Pack install not found')
  const { data, error } = await supabase
    .from('pack_installs')
    .update({
      enabled: input.enabled,
      disabled_at: input.enabled ? null : new Date().toISOString(),
    })
    .eq('id', input.installId)
    .select('*')
    .single()
  if (error) throw new Error(`Update pack install failed: ${error.message}`)
  return mapPackInstallRow(data)
}

export const uninstallPack = async (
  supabase: SupabaseClient,
  input: { productId: string; userId: string; installId: string },
): Promise<void> => {
  const { data: row, error: loadError } = await supabase
    .from('pack_installs')
    .select('id, product_id, user_id')
    .eq('id', input.installId)
    .maybeSingle()
  if (loadError) throw new Error(`Load pack install failed: ${loadError.message}`)
  if (!row || (row.product_id !== input.productId && row.user_id !== input.userId)) {
    throw new Error('Pack install not found')
  }
  const { error } = await supabase.from('pack_installs').delete().eq('id', input.installId)
  if (error) throw new Error(`Uninstall pack failed: ${error.message}`)
}

export const submitPackForReview = async (
  supabase: SupabaseClient,
  input: {
    slug: string
    kind: 'skill' | 'style'
    title: string
    blobKey: string
    checksumSha256: string
    signature?: string | null
    manifest: PackManifest
    submittedBy: string | null
    packId?: string | null
  },
): Promise<PackSubmission> => {
  const manifest = packManifestSchema.parse(input.manifest)
  const { data, error } = await supabase
    .from('pack_submissions')
    .insert({
      pack_id: input.packId ?? null,
      slug: input.slug,
      kind: input.kind,
      title: input.title,
      blob_key: input.blobKey,
      checksum_sha256: input.checksumSha256,
      signature: input.signature ?? null,
      manifest,
      status: 'queued',
      submitted_by: input.submittedBy,
    })
    .select('*')
    .single()
  if (error) throw new Error(`Submit pack failed: ${error.message}`)
  return mapPackSubmissionRow(data)
}

export const listPackSubmissions = async (
  supabase: SupabaseClient,
  input?: { status?: 'queued' | 'approved' | 'rejected' },
): Promise<PackSubmission[]> => {
  let query = supabase
    .from('pack_submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (input?.status) query = query.eq('status', input.status)
  const { data, error } = await query
  if (error) throw new Error(`List pack submissions failed: ${error.message}`)
  return (data ?? []).map((row) => mapPackSubmissionRow(row))
}

export const reviewPackSubmission = async (
  supabase: SupabaseClient,
  input: {
    submissionId: string
    decision: 'approved' | 'rejected'
    curatorNote?: string
    publisher?: string
  },
): Promise<{ submission: PackSubmission; pack?: PackCatalog; version?: PackVersion }> => {
  const { data: existing, error: loadError } = await supabase
    .from('pack_submissions')
    .select('*')
    .eq('id', input.submissionId)
    .maybeSingle()
  if (loadError) throw new Error(`Load submission failed: ${loadError.message}`)
  if (!existing) throw new Error(`Unknown submission ${input.submissionId}`)
  const current = mapPackSubmissionRow(existing)
  if (current.status !== 'queued') {
    throw new Error(`Submission already ${current.status}`)
  }

  const reviewedAt = new Date().toISOString()
  if (input.decision === 'rejected') {
    const { data, error } = await supabase
      .from('pack_submissions')
      .update({
        status: 'rejected',
        curator_note: input.curatorNote ?? null,
        reviewed_at: reviewedAt,
      })
      .eq('id', input.submissionId)
      .select('*')
      .single()
    if (error) throw new Error(`Reject submission failed: ${error.message}`)
    return { submission: mapPackSubmissionRow(data) }
  }

  const manifest = packManifestSchema.parse(current.manifest)
  let packId = current.packId
  let pack: PackCatalog | undefined

  if (!packId) {
    const { data: created, error: createError } = await supabase
      .from('pack_catalog')
      .insert({
        slug: current.slug,
        kind: current.kind,
        title: current.title,
        summary: manifest.summary ?? '',
        publisher: input.publisher ?? 'hepteract',
        status: 'published',
      })
      .select('*')
      .single()
    if (createError) throw new Error(`Create pack catalog failed: ${createError.message}`)
    pack = mapPackCatalogRow(created)
    packId = pack.id
  } else {
    const { data: updated, error: updateError } = await supabase
      .from('pack_catalog')
      .update({
        title: current.title,
        summary: manifest.summary ?? '',
        status: 'published',
        updated_at: reviewedAt,
      })
      .eq('id', packId)
      .select('*')
      .single()
    if (updateError) throw new Error(`Update pack catalog failed: ${updateError.message}`)
    pack = mapPackCatalogRow(updated)
  }

  const { data: versionRow, error: versionError } = await supabase
    .from('pack_versions')
    .insert({
      pack_id: packId,
      semver: manifest.semver,
      blob_key: current.blobKey,
      checksum_sha256: current.checksumSha256,
      signature: current.signature,
      manifest,
      published_at: reviewedAt,
    })
    .select('*')
    .single()
  if (versionError) throw new Error(`Publish pack version failed: ${versionError.message}`)
  const version = mapPackVersionRow(versionRow)

  const { data: submissionRow, error: submissionError } = await supabase
    .from('pack_submissions')
    .update({
      status: 'approved',
      pack_id: packId,
      curator_note: input.curatorNote ?? null,
      reviewed_at: reviewedAt,
    })
    .eq('id', input.submissionId)
    .select('*')
    .single()
  if (submissionError) throw new Error(`Approve submission failed: ${submissionError.message}`)

  return {
    submission: mapPackSubmissionRow(submissionRow),
    pack,
    version,
  }
}

export const installPublishedPackVersion = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  userId: string
  packVersionId: string
  scope?: PackInstallScope
  publicKeyPem?: string | null
  allowUnsigned?: boolean
}) =>
  installPackVersion({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    productId: input.productId,
    userId: input.userId,
    packVersionId: input.packVersionId,
    scope: input.scope,
    publicKeyPem: input.publicKeyPem,
    allowUnsigned: input.allowUnsigned ?? allowUnsignedPacksFromEnv(),
  })
