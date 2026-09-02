import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteBlob, putBlob, type BlobEnv } from '../persistence/blob'
import type { BrandChrome, ProjectAsset, StudioProject } from '../project/schema'
import { studioProjectSchema } from '../project/schema'
import { brandPromptContextSchema, type BrandPromptContext } from './prompt-context'

const nextRevision = (project: StudioProject) => project.revision + 1

const brandAssetIds = (brand: NonNullable<StudioProject['brand']>): Set<string> => {
  const ids = new Set<string>()
  if (brand.logoAssetId) ids.add(brand.logoAssetId)
  if (brand.logoMonoAssetId) ids.add(brand.logoMonoAssetId)
  if (brand.stillAssetId) ids.add(brand.stillAssetId)
  for (const id of brand.stillAssetIds ?? []) ids.add(id)
  return ids
}

const normalizeStillIds = (
  brand: NonNullable<StudioProject['brand']>,
): { stillAssetIds: string[]; stillAssetId?: string } => {
  const fromArray = brand.stillAssetIds ?? []
  const stillAssetIds =
    fromArray.length > 0 ? fromArray : brand.stillAssetId ? [brand.stillAssetId] : []
  return { stillAssetIds, stillAssetId: stillAssetIds[0] }
}

export const brandPromptContextFromProject = (project: StudioProject): BrandPromptContext => {
  const brand = project.brand
  if (!brand) {
    throw new Error(
      'No project brand. Open Brand in the header to set logo and colors, then try again.',
    )
  }
  const paletteHex = [brand.primaryColor, brand.accentColor].filter((value): value is string =>
    Boolean(value),
  )
  return brandPromptContextSchema.parse({
    productId: brand.productId,
    displayName: brand.displayName ?? brand.productId,
    mood: brand.mood?.trim() || 'neutral',
    paletteHex: paletteHex.length > 0 ? paletteHex : ['#666666'],
    promptTokens: [],
    forbiddenClaims: [],
    doNotes: [],
    dontNotes: [],
    voiceId: brand.voiceId?.trim() || 'default',
    speakingNotes: '',
    defaultCta: brand.defaultCta?.trim() || 'Learn more',
    neverFakeProductChrome: true,
  })
}

export type BrandFieldPatch = {
  displayName?: string
  primaryColor?: string
  accentColor?: string
  captionBg?: string
  fontFamily?: string
  voiceId?: string
  defaultCta?: string
  mood?: string
  primaryStillAssetId?: string
  chrome?: BrandChrome
  clearLogo?: boolean
  clearLogoMono?: boolean
}

export const updateProjectBrand = (
  project: StudioProject,
  patch: BrandFieldPatch,
): StudioProject => {
  const base =
    project.brand ??
    ({
      productId: project.productId,
      stillAssetIds: [],
    } satisfies NonNullable<StudioProject['brand']>)

  let stills = normalizeStillIds(base)
  if (patch.primaryStillAssetId) {
    const id = patch.primaryStillAssetId
    const rest = stills.stillAssetIds.filter((item) => item !== id)
    stills = { stillAssetIds: [id, ...rest], stillAssetId: id }
  }

  const brand = {
    ...base,
    ...stills,
    displayName: patch.displayName ?? base.displayName,
    primaryColor: patch.primaryColor ?? base.primaryColor,
    accentColor: patch.accentColor ?? base.accentColor,
    captionBg: patch.captionBg ?? base.captionBg,
    fontFamily: patch.fontFamily ?? base.fontFamily,
    voiceId: patch.voiceId ?? base.voiceId,
    defaultCta: patch.defaultCta ?? base.defaultCta,
    mood: patch.mood ?? base.mood,
    chrome: patch.chrome ?? base.chrome,
    logoAssetId: patch.clearLogo ? undefined : base.logoAssetId,
    logoMonoAssetId: patch.clearLogoMono ? undefined : base.logoMonoAssetId,
  }

  return studioProjectSchema.parse({
    ...project,
    brand,
    revision: nextRevision(project),
  })
}

export const setBrandLogoAsset = (
  project: StudioProject,
  input: { asset: ProjectAsset; role?: 'primary' | 'mono' },
): StudioProject => {
  const role = input.role ?? 'primary'
  const base =
    project.brand ??
    ({
      productId: project.productId,
      stillAssetIds: [],
    } satisfies NonNullable<StudioProject['brand']>)
  const stills = normalizeStillIds(base)
  const prevId = role === 'mono' ? base.logoMonoAssetId : base.logoAssetId
  const assets = [
    ...project.assets.filter((item) => item.id !== prevId && item.id !== input.asset.id),
    input.asset,
  ]
  return studioProjectSchema.parse({
    ...project,
    assets,
    brand: {
      ...base,
      ...stills,
      logoAssetId: role === 'primary' ? input.asset.id : base.logoAssetId,
      logoMonoAssetId: role === 'mono' ? input.asset.id : base.logoMonoAssetId,
    },
    revision: nextRevision(project),
  })
}

export const addBrandStillAsset = (
  project: StudioProject,
  asset: ProjectAsset,
  opts?: { makePrimary?: boolean },
): StudioProject => {
  const base =
    project.brand ??
    ({
      productId: project.productId,
      stillAssetIds: [],
    } satisfies NonNullable<StudioProject['brand']>)
  const stills = normalizeStillIds(base)
  const withoutDup = stills.stillAssetIds.filter((id) => id !== asset.id)
  const stillAssetIds = opts?.makePrimary ? [asset.id, ...withoutDup] : [...withoutDup, asset.id]
  const assets = [...project.assets.filter((item) => item.id !== asset.id), asset]
  return studioProjectSchema.parse({
    ...project,
    assets,
    brand: {
      ...base,
      stillAssetIds,
      stillAssetId: stillAssetIds[0],
    },
    revision: nextRevision(project),
  })
}

export const removeBrandStillAsset = (project: StudioProject, assetId: string): StudioProject => {
  if (!project.brand) {
    throw new Error('No project brand')
  }
  const stills = normalizeStillIds(project.brand)
  if (!stills.stillAssetIds.includes(assetId) && project.brand.stillAssetId !== assetId) {
    throw new Error(`Still ${assetId} is not part of project brand`)
  }
  const stillAssetIds = stills.stillAssetIds.filter((id) => id !== assetId)
  return studioProjectSchema.parse({
    ...project,
    assets: project.assets.filter((item) => item.id !== assetId),
    brand: {
      ...project.brand,
      stillAssetIds,
      stillAssetId: stillAssetIds[0],
    },
    revision: nextRevision(project),
  })
}

export const clearProjectBrand = (project: StudioProject): StudioProject => {
  const ids = project.brand ? brandAssetIds(project.brand) : new Set<string>()
  return studioProjectSchema.parse({
    ...project,
    assets: project.assets.filter((item) => item.source !== 'brand_kit' && !ids.has(item.id)),
    brand: undefined,
    revision: nextRevision(project),
  })
}

export const uploadBrandImageAsset = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  project: StudioProject
  fileName: string
  contentType: string
  data: Buffer
  probe?: Record<string, unknown>
}): Promise<{ asset: ProjectAsset; blobKey: string }> => {
  const assetId = randomUUID()
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.project.productId,
    kind: 'brand-kit',
    parts: [input.project.id, assetId, safeName],
    data: input.data,
    contentType: input.contentType,
  })
  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.project.productId,
    project_id: input.project.id,
    kind: 'image',
    source: 'upload',
    blob_key: blobKey,
    content_type: input.contentType,
    probe: { brandUpload: true, ...input.probe },
  })
  if (error) {
    try {
      await deleteBlob({ blobEnv: input.blobEnv, blobKey })
    } catch {
      /* best effort */
    }
    throw new Error(`Failed to register brand upload: ${error.message}`)
  }
  return {
    asset: {
      id: assetId,
      kind: 'image',
      blobKey,
      contentType: input.contentType,
      source: 'upload',
      probe: { brandUpload: true, ...input.probe },
    },
    blobKey,
  }
}
