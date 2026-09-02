/** Load primary entry markdown from a published pack version artifact. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlobBytes, type BlobEnv } from '../persistence/blob'
import { decodePackArtifact } from './install'
import { mapPackVersionRow, packManifestSchema } from './schema'

const stripFrontmatter = (raw: string): { body: string; name?: string; description?: string } => {
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
  return { body, name: fields.name, description: fields.description }
}

export const loadPackVersionPreview = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  packVersionId: string
}): Promise<{
  title: string
  entryPath: string
  markdown: string
  kind: 'skill' | 'style'
}> => {
  const { data, error } = await input.supabase
    .from('pack_versions')
    .select('*')
    .eq('id', input.packVersionId)
    .maybeSingle()
  if (error) throw new Error(`Load pack version failed: ${error.message}`)
  if (!data) throw new Error(`Unknown pack version ${input.packVersionId}`)

  const version = mapPackVersionRow(data)
  const manifest = packManifestSchema.parse(version.manifest)
  const entryPath = manifest.entries[0]
  if (!entryPath) throw new Error('Pack has no entry files')

  const bytes = await getBlobBytes({ blobEnv: input.blobEnv, blobKey: version.blobKey })
  const envelope = decodePackArtifact(bytes)
  const raw = envelope.files[entryPath]
  if (typeof raw !== 'string') throw new Error(`Missing entry ${entryPath} in pack artifact`)

  const parsed = stripFrontmatter(raw)
  return {
    title: parsed.name ?? manifest.title,
    entryPath,
    markdown: parsed.body,
    kind: manifest.kind,
  }
}
