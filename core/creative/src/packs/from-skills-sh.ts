/** Fetch Agent Skills from skills.sh / GitHub and wrap as ADR-0039 packs (#956). */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlobEnv } from '../persistence/blob'
import { putBlob } from '../persistence/blob'
import { buildUnsignedLocalArtifact } from './install'
import { installPublishedPackVersion } from './catalog'
import type { PackInstallScope } from './install-scope'
import type { PackManifest } from './schema'

export const SKILLS_SH_MAX_MARKDOWN_BYTES = 512_000

export type SkillsShRef = {
  owner: string
  repo: string
  entryPath: string
}

const GITHUB_RAW = 'https://raw.githubusercontent.com'

export const parseSkillsShSource = (raw: string): SkillsShRef => {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Paste owner/repo or a skills.sh / GitHub URL.')
  if (/scripts\//i.test(trimmed) || /\.(exe|sh|bat|cmd|dylib|so)$/i.test(trimmed)) {
    throw new Error('Hosted Studio refuses scripts/ and binaries from skills.sh.')
  }

  const withoutQuery = trimmed.split('?')[0] ?? trimmed
  const skillsSh = withoutQuery.match(/^https?:\/\/(?:www\.)?skills\.sh\/([^/]+)\/([^/]+)\/?$/i)
  if (skillsSh) {
    return { owner: skillsSh[1], repo: skillsSh[2], entryPath: 'SKILL.md' }
  }
  const rawGh = withoutQuery.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/[^/]+\/(.+)$/i,
  )
  if (rawGh) {
    return { owner: rawGh[1], repo: rawGh[2], entryPath: rawGh[3] }
  }
  const blobGh = withoutQuery.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/blob\/[^/]+\/(.+)$/i,
  )
  if (blobGh) {
    return { owner: blobGh[1], repo: blobGh[2], entryPath: blobGh[3] }
  }
  const repoGh = withoutQuery.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/?$/i)
  if (repoGh) {
    return { owner: repoGh[1], repo: repoGh[2], entryPath: 'SKILL.md' }
  }
  const short = withoutQuery.match(/^([^/\s]+)\/([^/\s]+)(?:\/(.+))?$/)
  if (short && !withoutQuery.includes('://')) {
    return {
      owner: short[1],
      repo: short[2],
      entryPath: short[3]?.replace(/\/$/, '') || 'SKILL.md',
    }
  }
  throw new Error('Could not parse that skills.sh / GitHub reference.')
}

const slugFromRef = (ref: SkillsShRef): string => {
  const base = `${ref.owner}-${ref.repo}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  return base.slice(0, 80)
}

const titleFromMarkdown = (markdown: string, fallback: string): string => {
  const named = markdown.match(/^name:\s*(.+)$/m)
  if (named?.[1]) return named[1].trim().replace(/^['"]|['"]$/g, '')
  const heading = markdown.match(/^#\s+(.+)$/m)
  if (heading?.[1]) return heading[1].trim()
  return fallback
}

export const assertHostedSkillPathAllowed = (entryPath: string): void => {
  const normalized = entryPath.replace(/\\/g, '/')
  if (normalized.split('/').includes('scripts') || /(^|\/)scripts\//i.test(normalized)) {
    throw new Error('Hosted Studio refuses scripts/ from skills.sh.')
  }
  if (/\.(exe|sh|bat|cmd|dylib|so)$/i.test(normalized)) {
    throw new Error('Hosted Studio refuses binaries from skills.sh.')
  }
}

export const wrapSkillMarkdownAsPack = (input: {
  ref: SkillsShRef
  markdown: string
}): { manifest: PackManifest; files: Record<string, string> } => {
  if (Buffer.byteLength(input.markdown, 'utf8') > SKILLS_SH_MAX_MARKDOWN_BYTES) {
    throw new Error(`SKILL.md is over ${SKILLS_SH_MAX_MARKDOWN_BYTES} bytes.`)
  }
  assertHostedSkillPathAllowed(input.ref.entryPath)
  const slug = slugFromRef(input.ref)
  const title = titleFromMarkdown(input.markdown, slug)
  const manifest: PackManifest = {
    id: slug,
    slug,
    kind: 'skill',
    semver: '1.0.0',
    mosApiVersion: 1,
    title,
    entries: ['SKILL.md'],
    requiresConfirmSpend: true,
  }
  return { manifest, files: { 'SKILL.md': input.markdown } }
}

export const skillMarkdownCandidatePaths = (ref: SkillsShRef): string[] => {
  const requested = ref.entryPath.replace(/^\//, '') || 'SKILL.md'
  const paths = [requested]
  if (requested === 'SKILL.md') {
    paths.push(`skills/${ref.repo}/SKILL.md`, 'skills/SKILL.md')
  }
  return [...new Set(paths)]
}

export const fetchSkillMarkdown = async (input: {
  ref: SkillsShRef
  fetchImpl?: typeof fetch
}): Promise<{ markdown: string; entryPath: string }> => {
  const fetchFn = input.fetchImpl ?? fetch
  const tried: string[] = []
  for (const entryPath of skillMarkdownCandidatePaths(input.ref)) {
    assertHostedSkillPathAllowed(entryPath)
    const url = `${GITHUB_RAW}/${input.ref.owner}/${input.ref.repo}/HEAD/${entryPath}`
    const response = await fetchFn(url, { redirect: 'follow' })
    if (response.status === 404) {
      tried.push(entryPath)
      continue
    }
    if (!response.ok) {
      throw new Error(`Could not fetch ${entryPath} (${response.status}).`)
    }
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > SKILLS_SH_MAX_MARKDOWN_BYTES) {
      throw new Error(`SKILL.md is over ${SKILLS_SH_MAX_MARKDOWN_BYTES} bytes.`)
    }
    if (!text.trim()) throw new Error('Fetched skill file was empty.')
    return { markdown: text, entryPath }
  }
  throw new Error(`Could not fetch SKILL.md (${tried.join(', ')} were missing).`)
}

export const importSkillFromSkillsSh = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  userId: string
  source: string
  scope?: PackInstallScope
  fetchImpl?: typeof fetch
}) => {
  const ref = parseSkillsShSource(input.source)
  const fetched = await fetchSkillMarkdown({ ref, fetchImpl: input.fetchImpl })
  const wrapped = wrapSkillMarkdownAsPack({
    ref: { ...ref, entryPath: fetched.entryPath },
    markdown: fetched.markdown,
  })
  const { bytes, checksumSha256 } = buildUnsignedLocalArtifact(wrapped.manifest, wrapped.files)

  const { data: pack, error: packError } = await input.supabase
    .from('pack_catalog')
    .upsert(
      {
        slug: wrapped.manifest.slug,
        kind: 'skill',
        title: wrapped.manifest.title,
        summary: `Imported from ${ref.owner}/${ref.repo}`,
        publisher: ref.owner,
        status: 'published',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' },
    )
    .select('*')
    .single()
  if (packError) throw new Error(`Publish imported pack failed: ${packError.message}`)

  const uploaded = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'uploads',
    parts: ['pack-catalog', wrapped.manifest.slug, `${wrapped.manifest.semver}.pack.json`],
    data: bytes,
    contentType: 'application/json',
  })

  const { data: version, error: versionError } = await input.supabase
    .from('pack_versions')
    .upsert(
      {
        pack_id: pack.id,
        semver: wrapped.manifest.semver,
        blob_key: uploaded.blobKey,
        checksum_sha256: checksumSha256,
        signature: null,
        manifest: wrapped.manifest,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'pack_id,semver' },
    )
    .select('*')
    .single()
  if (versionError) throw new Error(`Publish imported pack version failed: ${versionError.message}`)

  return installPublishedPackVersion({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    productId: input.productId,
    userId: input.userId,
    packVersionId: version.id as string,
    scope: input.scope,
    allowUnsigned: true,
  })
}
