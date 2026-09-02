import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { startAssetIndexAfterAttach } from '../asset-intelligence/start-index-after-attach'
import { deleteBlob, putBlob, type BlobEnv } from '../persistence/blob'
import { attachAsset, addClip } from './operations'
import { loadProject } from './load'
import {
  durationFramesFromSeconds,
  extractVideoPosterJpeg,
  probeMediaDurationSeconds,
} from './media-probe'
import { saveProject } from './save'
import type { ProjectAsset, StudioProject } from './schema'

export type UploadedAssetResult = {
  asset: ProjectAsset
  project: StudioProject
  signedUrl?: string
}

export const uploadProjectAsset = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  projectId: string
  expectedRevision: number
  fileName: string
  contentType: string
  data: Buffer
  kind?: ProjectAsset['kind']
  addAsClip?: boolean
  /** Defaults to upload. URL ingest (#108) stores bytes in Blob with source url. */
  source?: Extract<ProjectAsset['source'], 'upload' | 'url'>
  probeExtras?: Record<string, unknown>
}): Promise<UploadedAssetResult> => {
  const { project } = await loadProject(input.supabase, input.projectId)
  if (project.revision !== input.expectedRevision) {
    throw new Error(
      `Project revision conflict: expected ${input.expectedRevision}, found ${project.revision}`,
    )
  }

  const assetId = randomUUID()
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  const kind = input.kind ?? inferKind(input.contentType, safeName)
  const source = input.source ?? 'upload'

  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: project.productId,
    kind: 'uploads',
    parts: [project.id, `${assetId}-${safeName}`],
    data: input.data,
    contentType: input.contentType,
  })

  const probe: Record<string, unknown> = {
    name: input.fileName.slice(0, 120),
    ...(input.probeExtras ?? {}),
  }
  let posterBlobKey: string | undefined

  if (kind === 'video' || kind === 'audio') {
    const seconds = await probeMediaDurationSeconds(input.data, input.contentType, input.fileName)
    if (seconds !== null) {
      probe.durationSeconds = seconds
      probe.durationFrames = durationFramesFromSeconds(seconds, project.fps)
    }
  }

  if (kind === 'video') {
    const poster = await extractVideoPosterJpeg(input.data, input.contentType, input.fileName)
    if (poster) {
      const posterPut = await putBlob({
        blobEnv: input.blobEnv,
        productId: project.productId,
        kind: 'uploads',
        parts: [project.id, `${assetId}-poster.jpg`],
        data: poster,
        contentType: 'image/jpeg',
      })
      posterBlobKey = posterPut.blobKey
      probe.posterBlobKey = posterBlobKey
    }
  }

  const projectAsset: ProjectAsset = {
    id: assetId,
    kind,
    blobKey,
    contentType: input.contentType,
    source,
    probe,
  }

  const assetRow = {
    id: assetId,
    product_id: project.productId,
    project_id: project.id,
    kind,
    source,
    blob_key: blobKey,
    content_type: input.contentType,
    probe: projectAsset.probe,
  }

  const { error: insertError } = await input.supabase.from('assets').insert(assetRow)
  if (insertError) {
    try {
      await deleteBlob({ blobEnv: input.blobEnv, blobKey })
      if (posterBlobKey) await deleteBlob({ blobEnv: input.blobEnv, blobKey: posterBlobKey })
    } catch (cleanupError) {
      console.error('Compensating Blob delete failed after asset insert error', {
        blobKey,
        insertError: insertError.message,
        cleanupError,
      })
    }
    throw new Error(`Failed to persist asset row: ${insertError.message}`)
  }

  let next = attachAsset(project, projectAsset)
  if (input.addAsClip !== false && kind === 'video') {
    next = addClip(next, { assetId })
  }

  try {
    const saved = await saveProject(input.supabase, next, input.expectedRevision)
    // ADR-0032: index on attach. Enqueue after save so metering failures cannot
    // roll back a successful upload (#457). Generated clips use the same helper (#525).
    await startAssetIndexAfterAttach({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId: project.productId,
      projectId: project.id,
      assetId,
      source: 'upload',
    })
    return { asset: projectAsset, project: saved.project }
  } catch (error) {
    try {
      await input.supabase.from('assets').delete().eq('id', assetId)
      await deleteBlob({ blobEnv: input.blobEnv, blobKey })
      if (posterBlobKey) await deleteBlob({ blobEnv: input.blobEnv, blobKey: posterBlobKey })
    } catch (cleanupError) {
      console.error('Compensating cleanup failed after project save error', {
        assetId,
        blobKey,
        cleanupError,
      })
    }
    throw error
  }
}

const inferKind = (contentType: string, fileName: string): ProjectAsset['kind'] => {
  if (contentType.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(fileName)) {
    return 'video'
  }
  if (contentType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName)) {
    return 'image'
  }
  if (contentType.startsWith('audio/') || /\.(mp3|wav|m4a|aac)$/i.test(fileName)) {
    return 'audio'
  }
  return 'other'
}
