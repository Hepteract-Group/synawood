import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addClip,
  attachAsset,
  autoFitDuration,
  resolveMagneticClipFrom,
} from '../project/operations'
import {
  isAuthoredComposition,
  studioProjectSchema,
  type ProjectAsset,
  type StudioProject,
} from '../project/schema'
import { BROLL_TRACK_ID } from '../project/tracks'
import { assertOwnedBlobKey } from './assert-blob-key'
import { getProductExtract as getProductExtractDefault } from './get-product-extract'
import type { ProductExtract } from './product-extract-schema'

const PLACE_EXTRACT_CODE = 'place_extract'

export const isPlaceExtractError = (
  error: unknown,
): error is Error & { status: number; code: typeof PLACE_EXTRACT_CODE } =>
  error instanceof Error && (error as { code?: unknown }).code === PLACE_EXTRACT_CODE

const fail = (message: string, status: 400 | 404): Error & { status: number; code: string } => {
  const error = new Error(message) as Error & { status: number; code: string }
  error.status = status
  error.code = PLACE_EXTRACT_CODE
  return error
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  png: 'image/png',
}

const contentTypeFromBlobKey = (blobKey: string): string => {
  const ext = blobKey.split('.').pop()?.toLowerCase() ?? 'png'
  return CONTENT_TYPE_BY_EXT[ext] ?? 'image/png'
}

const existingExtractAsset = (
  project: StudioProject,
  extractId: string,
): ProjectAsset | undefined =>
  project.assets.find((asset) => asset.probe?.productExtractId === extractId)

export type PlaceProductExtractDeps = {
  getExtract?: typeof getProductExtractDefault
}

export const placeProductExtractOnProject = async (input: {
  supabase: SupabaseClient
  project: StudioProject
  extractId: string
  deps?: PlaceProductExtractDeps
}): Promise<{ project: StudioProject; asset: ProjectAsset; clipId: string }> => {
  const getExtract = input.deps?.getExtract ?? getProductExtractDefault

  const extract = await getExtract({
    supabase: input.supabase,
    productId: input.project.productId,
    extractId: input.extractId,
  })
  if (!extract) {
    throw fail('Extract not found on this product', 404)
  }
  if (extract.kind === 'text') {
    throw fail('Text extracts cannot be placed on the cut', 400)
  }
  if (!extract.blobKey) {
    throw fail('This extract has no still to place', 400)
  }
  try {
    assertOwnedBlobKey(extract.blobKey)
  } catch (error) {
    throw fail(error instanceof Error ? error.message : 'Extract still must be Blob-backed', 400)
  }

  const reused = existingExtractAsset(input.project, extract.id)
  const asset = reused ?? (await registerExtractStillOnProject({ ...input, extract }))

  let project = reused ? input.project : attachAsset(input.project, asset)
  project = isAuthoredComposition(project.compositionId)
    ? addAuthoredOverlayClip(project, asset.id)
    : addClip(project, {
        assetId: asset.id,
        from: project.clips.reduce(
          (end, clip) => Math.max(end, clip.from + clip.durationInFrames),
          0,
        ),
      })
  const clip = [...project.clips].reverse().find((item) => item.assetId === asset.id)
  if (!clip) {
    throw fail('Failed to place extract still on the cut', 400)
  }
  return { project, asset, clipId: clip.id }
}

/** Authored ads keep MAIN empty. addClip would remap B-roll onto MAIN when picture is empty. */
const addAuthoredOverlayClip = (project: StudioProject, assetId: string): StudioProject => {
  const durationInFrames = 90
  const requestedFrom = project.clips
    .filter((clip) => clip.trackId === BROLL_TRACK_ID)
    .reduce((end, clip) => Math.max(end, clip.from + clip.durationInFrames), 0)
  const from = resolveMagneticClipFrom(project, {
    trackId: BROLL_TRACK_ID,
    from: requestedFrom,
    durationInFrames,
  })
  return studioProjectSchema.parse(
    autoFitDuration({
      ...project,
      clips: [
        ...project.clips,
        {
          id: `clip_${randomUUID()}`,
          trackId: BROLL_TRACK_ID,
          assetId,
          from,
          durationInFrames,
          trim: { startFrames: 0 },
        },
      ],
      revision: project.revision + 1,
    }),
  )
}

const registerExtractStillOnProject = async (input: {
  supabase: SupabaseClient
  project: StudioProject
  extract: ProductExtract
}): Promise<ProjectAsset> => {
  const extract = input.extract
  const blobKey = extract.blobKey!
  const contentType = contentTypeFromBlobKey(blobKey)
  const assetId = randomUUID()
  const probe = {
    extract: true,
    role: extract.kind,
    sourceUrl: extract.sourceUrl,
    productExtractId: extract.id,
    quality: extract.quality,
  }
  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.project.productId,
    project_id: input.project.id,
    kind: 'image',
    source: 'upload',
    blob_key: blobKey,
    content_type: contentType,
    probe,
  })
  if (error) {
    throw new Error(`Failed to register extract still: ${error.message}`)
  }
  return {
    id: assetId,
    kind: 'image',
    blobKey,
    contentType,
    source: 'upload',
    probe,
  }
}
