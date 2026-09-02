/** Load enabled installed skill packs into MarketingSkill rows (#289). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlobText, type BlobEnv } from '../persistence/blob'
import { buildBlobKey } from '../persistence/blob-key'
import type { MarketingSkill } from '../agent/skills/select'
import { accountInstallBlobProductId } from './install-scope'
import { mapPackVersionRow, packManifestSchema } from './schema'

const parseFrontmatter = (raw: string): { name?: string; description?: string; body: string } => {
  if (!raw.startsWith('---')) return { body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { body: raw }
  const front = raw.slice(3, end).trim()
  const body = raw.slice(end + 4).trim()
  const fields: Record<string, string> = {}
  for (const line of front.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { name: fields.name, description: fields.description, body }
}

export const installedPackSkillBlobKey = (input: {
  productId: string
  slug: string
  semver: string
  entry: string
  useLocalPrefix: boolean
}): string =>
  buildBlobKey({
    productId: input.productId,
    kind: 'uploads',
    parts: ['packs', input.productId, input.slug, input.semver, ...input.entry.split('/')],
    localPrefix: input.useLocalPrefix,
  })

export const listInstalledPackSkills = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  userId?: string
}): Promise<MarketingSkill[]> => {
  const productRows = await input.supabase
    .from('pack_installs')
    .select('id, pack_version_id, enabled, product_id, user_id')
    .eq('product_id', input.productId)
    .eq('enabled', true)
  if (productRows.error) throw new Error(`List pack installs failed: ${productRows.error.message}`)
  const accountRows = input.userId
    ? await input.supabase
        .from('pack_installs')
        .select('id, pack_version_id, enabled, product_id, user_id')
        .eq('user_id', input.userId)
        .eq('enabled', true)
    : { data: [] as Array<Record<string, unknown>>, error: null }
  if (accountRows.error) throw new Error(`List pack installs failed: ${accountRows.error.message}`)
  const installs = [...(productRows.data ?? []), ...(accountRows.data ?? [])]
  if (!installs.length) return []

  const versionIds = installs.map((row) => row.pack_version_id as string)
  const { data: versions, error: versionError } = await input.supabase
    .from('pack_versions')
    .select('*')
    .in('id', versionIds)
  if (versionError) throw new Error(`List pack versions failed: ${versionError.message}`)

  const { data: revocations, error: revocationError } = await input.supabase
    .from('pack_revocations')
    .select('pack_version_id')
    .in('pack_version_id', versionIds)
  if (revocationError) {
    throw new Error(`List pack revocations failed: ${revocationError.message}`)
  }
  const revoked = new Set((revocations ?? []).map((row) => row.pack_version_id as string))

  const blobProductIdByVersion = new Map<string, string>()
  for (const install of installs) {
    const versionId = install.pack_version_id as string
    const blobProductId =
      typeof install.user_id === 'string' && install.user_id
        ? accountInstallBlobProductId(install.user_id)
        : ((install.product_id as string | null) ?? input.productId)
    blobProductIdByVersion.set(versionId, blobProductId)
  }

  const skills: MarketingSkill[] = []
  for (const row of versions ?? []) {
    if (revoked.has(row.id as string)) continue
    const version = mapPackVersionRow(row)
    const manifest = packManifestSchema.parse(version.manifest)
    if (manifest.kind !== 'skill') continue
    const entry = manifest.entries[0] ?? 'SKILL.md'
    const blobKey = installedPackSkillBlobKey({
      productId: blobProductIdByVersion.get(version.id) ?? input.productId,
      slug: manifest.slug,
      semver: version.semver,
      entry,
      useLocalPrefix: input.blobEnv.useLocalPrefix,
    })
    try {
      const raw = await getBlobText({ blobEnv: input.blobEnv, blobKey })
      const parsed = parseFrontmatter(raw)
      skills.push({
        id: `installed:${manifest.slug}`,
        name: parsed.name ?? manifest.title,
        description: parsed.description ?? manifest.summary ?? '',
        excerpt: parsed.body.slice(0, 900),
        category: 'core',
        locked: false,
      })
    } catch {
      // Missing blob — skip; founder can reinstall.
    }
  }
  return skills
}
