import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlobBytes, putBlob, type BlobEnv } from '../persistence/blob'
import type { StudioProject } from '../project/schema'
import { studioProjectSchema } from '../project/schema'
import { loadBrandKitFiles, buildBrandPromptContext } from './attach'
import { loadBrandDna } from './product-copy'
import type { BrandPromptContext } from './prompt-context'
import {
  productBrandLibrarySchema,
  type ProductBrandLibrary,
  type ProductBrandLibraryAsset,
} from './library-schema'

const contentTypeForPath = (relPath: string): string => {
  const ext = path.extname(relPath).toLowerCase()
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

const uploadProductLibraryFile = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  relPath: string
  absolutePath: string
  label?: string
}): Promise<ProductBrandLibraryAsset> => {
  const bytes = await readFile(input.absolutePath)
  const assetId = randomUUID()
  const ext = path.extname(input.relPath).replace('.', '') || 'bin'
  const contentType = contentTypeForPath(input.relPath)
  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'brand-kit',
    parts: [
      'library',
      assetId,
      `${path.basename(input.relPath, path.extname(input.relPath))}.${ext}`,
    ],
    data: bytes,
    contentType,
  })
  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.productId,
    project_id: null,
    kind: 'image',
    source: 'brand_kit',
    blob_key: blobKey,
    content_type: contentType,
    probe: { brandLibrary: true, brandKitPath: input.relPath, label: input.label },
  })
  if (error) {
    throw new Error(`Failed to register product brand asset: ${error.message}`)
  }
  return { assetId, blobKey, contentType, label: input.label ?? input.relPath }
}

export const readProductBrandLibrary = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductBrandLibrary | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('brand_library')
    .eq('id', productId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to read product brand library: ${error.message}`)
  }
  if (!data?.brand_library) return null
  const parsed = productBrandLibrarySchema.safeParse(data.brand_library)
  return parsed.success ? parsed.data : null
}

export const seedProductBrandLibraryFromDisk = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  repoRoot?: string
}): Promise<ProductBrandLibrary> => {
  const kit = await loadBrandKitFiles(input.productId, input.repoRoot)
  const logoPrimary = await uploadProductLibraryFile({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    productId: input.productId,
    relPath: kit.manifest.logo.primary,
    absolutePath: path.join(kit.root, kit.manifest.logo.primary),
    label: 'logo/primary',
  })
  let logoMono: ProductBrandLibraryAsset | undefined
  if (kit.manifest.logo.mono) {
    logoMono = await uploadProductLibraryFile({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId: input.productId,
      relPath: kit.manifest.logo.mono,
      absolutePath: path.join(kit.root, kit.manifest.logo.mono),
      label: 'logo/mono',
    })
  }
  const stills: ProductBrandLibraryAsset[] = []
  for (const stillRel of kit.manifest.stills ?? []) {
    stills.push(
      await uploadProductLibraryFile({
        supabase: input.supabase,
        blobEnv: input.blobEnv,
        productId: input.productId,
        relPath: stillRel,
        absolutePath: path.join(kit.root, stillRel),
        label: stillRel,
      }),
    )
  }

  const library = productBrandLibrarySchema.parse({
    version: 1,
    productId: input.productId,
    displayName: kit.manifest.displayName,
    defaultCta: kit.manifest.defaultCta,
    primaryColor: kit.colors.primary,
    accentColor: kit.colors.accent,
    captionBg: kit.colors.captionBg,
    fontFamily: kit.manifest.fonts.display,
    voiceId: kit.voice.voiceId,
    mood: kit.style.mood,
    logoPrimary,
    logoMono,
    stills,
    seededFromDiskAt: new Date().toISOString(),
  })

  const { error } = await input.supabase
    .from('products')
    .update({ brand_library: library })
    .eq('id', input.productId)
  if (error) {
    throw new Error(`Failed to save product brand library: ${error.message}`)
  }
  return library
}

export const ensureProductBrandLibrary = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  repoRoot?: string
}): Promise<ProductBrandLibrary> => {
  const existing = await readProductBrandLibrary(input.supabase, input.productId)
  if (existing) return existing
  try {
    return await seedProductBrandLibraryFromDisk(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      /Brand kit incomplete|missing or invalid|ENOENT|no such file|manifest\.json|Brand kit productId mismatch/i.test(
        message,
      )
    ) {
      throw new Error(
        `No brand library on this Product yet. Open Brand in the Studio header to set logo and colors, then import again.`,
      )
    }
    throw error
  }
}

const copyLibraryAssetIntoProject = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  libraryAsset: ProductBrandLibraryAsset
  probe?: Record<string, unknown>
}): Promise<{ assetId: string; blobKey: string; contentType: string }> => {
  const bytes = await getBlobBytes({ blobEnv: input.blobEnv, blobKey: input.libraryAsset.blobKey })
  const assetId = randomUUID()
  const base = path.basename(input.libraryAsset.blobKey)
  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'brand-kit',
    parts: [input.projectId, assetId, base],
    data: bytes,
    contentType: input.libraryAsset.contentType,
  })
  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.productId,
    project_id: input.projectId,
    kind: 'image',
    source: 'brand_kit',
    blob_key: blobKey,
    content_type: input.libraryAsset.contentType,
    probe: { importedFromLibrary: true, ...input.probe },
  })
  if (error) {
    throw new Error(`Failed to copy brand asset into project: ${error.message}`)
  }
  return { assetId, blobKey, contentType: input.libraryAsset.contentType }
}

export const importProductBrand = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  project: StudioProject
  productId?: string
  repoRoot?: string
}): Promise<{
  project: StudioProject
  promptContext: BrandPromptContext
  library: ProductBrandLibrary
}> => {
  const productId = input.productId ?? input.project.productId
  const library = await ensureProductBrandLibrary({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    productId,
    repoRoot: input.repoRoot,
  })

  const assets = input.project.assets.filter((asset) => asset.source !== 'brand_kit')
  const logo = await copyLibraryAssetIntoProject({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    productId,
    projectId: input.project.id,
    libraryAsset: library.logoPrimary,
    probe: { role: 'logo' },
  })
  assets.push({
    id: logo.assetId,
    kind: 'image',
    blobKey: logo.blobKey,
    contentType: logo.contentType,
    source: 'brand_kit',
    probe: { role: 'logo', label: library.logoPrimary.label },
  })

  let logoMonoAssetId: string | undefined
  if (library.logoMono) {
    const mono = await copyLibraryAssetIntoProject({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId,
      projectId: input.project.id,
      libraryAsset: library.logoMono,
      probe: { role: 'logo-mono' },
    })
    logoMonoAssetId = mono.assetId
    assets.push({
      id: mono.assetId,
      kind: 'image',
      blobKey: mono.blobKey,
      contentType: mono.contentType,
      source: 'brand_kit',
      probe: { role: 'logo-mono', label: library.logoMono.label },
    })
  }

  const stillAssetIds: string[] = []
  for (const still of library.stills) {
    const copied = await copyLibraryAssetIntoProject({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId,
      projectId: input.project.id,
      libraryAsset: still,
      probe: { role: 'still' },
    })
    stillAssetIds.push(copied.assetId)
    assets.push({
      id: copied.assetId,
      kind: 'image',
      blobKey: copied.blobKey,
      contentType: copied.contentType,
      source: 'brand_kit',
      probe: { role: 'still', label: still.label },
    })
  }

  const project = studioProjectSchema.parse({
    ...input.project,
    assets,
    brand: {
      productId,
      displayName: library.displayName,
      logoAssetId: logo.assetId,
      logoMonoAssetId,
      stillAssetId: stillAssetIds[0],
      stillAssetIds,
      primaryColor: library.primaryColor,
      accentColor: library.accentColor,
      captionBg: library.captionBg,
      fontFamily: library.fontFamily,
      voiceId: library.voiceId,
      defaultCta: library.defaultCta,
      mood: library.mood,
    },
    revision: input.project.revision + 1,
  })

  const promptContext = buildBrandPromptContext({
    productId,
    manifest: {
      productId,
      displayName: library.displayName,
      defaultCta: library.defaultCta,
      logo: { primary: library.logoPrimary.label ?? 'logo' },
      stills: library.stills.map((s) => s.label ?? s.assetId),
      fonts: {
        display: library.fontFamily ?? 'Georgia, "Times New Roman", serif',
        body: library.fontFamily ?? 'Georgia, "Times New Roman", serif',
      },
    },
    colors: {
      primary: library.primaryColor ?? '#666666',
      accent: library.accentColor,
      captionBg: library.captionBg,
    },
    style: { mood: library.mood ?? 'neutral' },
    voice: { voiceId: library.voiceId ?? 'default' },
    dna: (await loadBrandDna({ productId })).dna,
  })

  return { project, promptContext, library }
}
