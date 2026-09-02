/** Install pipeline for agent packs (ADR-0039 / #288). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlobBytes, putBlob, type BlobEnv } from '../persistence/blob'
import { assertPackSafe, type PackArchiveEntry } from './safety'
import { assertPackIntegrity, sha256Hex } from './signature'
import { resolvePackInstallScope, type PackInstallScope } from './install-scope'
import {
  mapPackInstallRow,
  mapPackVersionRow,
  packManifestSchema,
  type PackInstall,
  type PackManifest,
  type PackVersion,
} from './schema'

export type PackArtifactFileMap = Record<string, string>

/** On-disk / blob JSON envelope for a pack version (v1, no zip dependency). */
export type PackArtifactEnvelope = {
  manifest: PackManifest
  files: PackArtifactFileMap
}

export const encodePackArtifact = (envelope: PackArtifactEnvelope): Buffer =>
  Buffer.from(JSON.stringify(envelope), 'utf8')

export const decodePackArtifact = (bytes: Buffer | Uint8Array): PackArtifactEnvelope => {
  const raw = JSON.parse(Buffer.from(bytes).toString('utf8')) as {
    manifest?: unknown
    files?: PackArtifactFileMap
  }
  const manifest = packManifestSchema.parse(raw.manifest)
  const files = raw.files ?? {}
  return { manifest, files }
}

export const entriesFromArtifact = (envelope: PackArtifactEnvelope): PackArchiveEntry[] =>
  Object.entries(envelope.files).map(([path, content]) => ({
    path,
    size: Buffer.byteLength(content, 'utf8'),
  }))

export const installPackVersion = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  userId: string
  packVersionId: string
  scope?: PackInstallScope
  allowUnsigned?: boolean
  publicKeyPem?: string | null
}): Promise<{ install: PackInstall; version: PackVersion; manifest: PackManifest }> => {
  const scope = resolvePackInstallScope({
    scope: input.scope,
    productId: input.productId,
    userId: input.userId,
  })

  const { data: versionRow, error: versionError } = await input.supabase
    .from('pack_versions')
    .select('*')
    .eq('id', input.packVersionId)
    .maybeSingle()
  if (versionError) throw new Error(`Load pack version failed: ${versionError.message}`)
  if (!versionRow) throw new Error(`Unknown pack version ${input.packVersionId}`)
  const version = mapPackVersionRow(versionRow)

  const bytes = await getBlobBytes({ blobEnv: input.blobEnv, blobKey: version.blobKey })
  assertPackIntegrity({
    bytes,
    expectedChecksumSha256: version.checksumSha256,
    semver: version.semver,
    signatureBase64: version.signature,
    publicKeyPem: input.publicKeyPem,
    allowUnsigned: input.allowUnsigned === true,
  })

  const envelope = decodePackArtifact(bytes)
  const manifest = assertPackSafe({
    entries: entriesFromArtifact(envelope),
    manifestRaw: envelope.manifest,
  })

  // Materialize under Product- or Account-local prefix for the skill loader (#289 / #954).
  const installRootParts = ['packs', scope.blobProductId, manifest.slug, version.semver]
  for (const [relativePath, content] of Object.entries(envelope.files)) {
    await putBlob({
      blobEnv: input.blobEnv,
      productId: scope.blobProductId,
      kind: 'uploads',
      parts: [...installRootParts, ...relativePath.split('/')],
      data: content,
      contentType: 'text/plain; charset=utf-8',
    })
  }

  let existingQuery = input.supabase
    .from('pack_installs')
    .select('id')
    .eq('pack_version_id', version.id)
  existingQuery = scope.productId
    ? existingQuery.eq('product_id', scope.productId)
    : existingQuery.eq('user_id', scope.userId)
  const { data: existing, error: existingError } = await existingQuery.maybeSingle()
  if (existingError) throw new Error(`Load pack install failed: ${existingError.message}`)

  const payload = {
    product_id: scope.productId,
    user_id: scope.userId,
    pack_version_id: version.id,
    enabled: true,
    disabled_at: null,
    installed_at: new Date().toISOString(),
  }
  const persist = existing?.id
    ? input.supabase.from('pack_installs').update(payload).eq('id', existing.id)
    : input.supabase.from('pack_installs').insert(payload)
  const { data: installRow, error: installError } = await persist.select('*').single()
  if (installError) throw new Error(`Persist pack install failed: ${installError.message}`)

  return {
    install: mapPackInstallRow(installRow),
    version,
    manifest,
  }
}

export const buildUnsignedLocalArtifact = (manifest: PackManifest, files: PackArtifactFileMap) => {
  const envelope: PackArtifactEnvelope = { manifest, files }
  const bytes = encodePackArtifact(envelope)
  return { bytes, checksumSha256: sha256Hex(bytes), envelope }
}
