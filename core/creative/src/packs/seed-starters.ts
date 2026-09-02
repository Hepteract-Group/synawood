/** Publish in-repo starter pack fixtures into catalog (#296 / #490). */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { putBlob, type BlobEnv } from '../persistence/blob'
import { decodePackArtifact } from './install'
import { sha256Hex } from './signature'

const FIXTURE_FILES = [
  'hooks-first-3s-1.0.0.pack.json',
  'cinematic-teal-orange-1.0.0.pack.json',
] as const

export const seedStarterPacks = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  /** Product used only for Blob key namespace when uploading catalog artifacts. */
  productId: string
  fixturesRoot?: string
}): Promise<Array<{ slug: string; semver: string; blobKey: string }>> => {
  const root = input.fixturesRoot ?? path.resolve(process.cwd(), 'core/creative/fixtures/packs')
  // Next.js API cwd is often `dashboard/` — also try repo-relative from parent.
  const candidates = [
    root,
    path.resolve(process.cwd(), '../core/creative/fixtures/packs'),
    path.resolve(process.cwd(), 'fixtures/packs'),
  ]

  let fixturesDir = candidates.find((dir) => {
    try {
      readFileSync(path.join(dir, FIXTURE_FILES[0]))
      return true
    } catch {
      return false
    }
  })
  if (!fixturesDir) {
    throw new Error('Starter pack fixtures not found on disk.')
  }

  const published: Array<{ slug: string; semver: string; blobKey: string }> = []
  for (const fileName of FIXTURE_FILES) {
    const bytes = readFileSync(path.join(fixturesDir, fileName))
    const envelope = decodePackArtifact(bytes)
    const checksum = sha256Hex(bytes)
    const { manifest } = envelope

    const { data: pack, error: packError } = await input.supabase
      .from('pack_catalog')
      .upsert(
        {
          slug: manifest.slug,
          kind: manifest.kind,
          title: manifest.title,
          summary: manifest.summary ?? '',
          publisher: 'hepteract',
          status: 'published',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select('*')
      .single()
    if (packError) throw new Error(packError.message)

    const uploaded = await putBlob({
      blobEnv: input.blobEnv,
      productId: input.productId,
      kind: 'uploads',
      parts: ['pack-catalog', manifest.slug, `${manifest.semver}.pack.json`],
      data: bytes,
      contentType: 'application/json',
    })

    const { error: versionError } = await input.supabase.from('pack_versions').upsert(
      {
        pack_id: pack.id,
        semver: manifest.semver,
        blob_key: uploaded.blobKey,
        checksum_sha256: checksum,
        signature: null,
        manifest,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'pack_id,semver' },
    )
    if (versionError) throw new Error(versionError.message)

    published.push({
      slug: manifest.slug,
      semver: manifest.semver,
      blobKey: uploaded.blobKey,
    })
  }
  return published
}
