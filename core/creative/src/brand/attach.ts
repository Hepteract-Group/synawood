import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { putBlob, type BlobEnv } from '../persistence/blob'
import { mergeBrandKitForLocale } from '../locale/brand-merge'
import type { StudioProject } from '../project/schema'
import { studioProjectSchema } from '../project/schema'
import { brandPromptContextSchema, type BrandPromptContext, withBrandDna } from './prompt-context'
import { parseBrandDna, type BrandDna } from './dna'

const here = path.dirname(fileURLToPath(import.meta.url))

export const brandKitRoot = (productId: string, repoRoot?: string): string => {
  const root = repoRoot ?? path.resolve(here, '../../../..')
  return path.join(root, 'products', productId, 'brand-kit')
}

type Manifest = {
  productId: string
  displayName: string
  defaultCta: string
  defaultEndCardUrl?: string
  logo: { primary: string; mono?: string }
  stills: string[]
  fonts: { display: string; body: string }
}

type Colors = {
  primary: string
  primaryMuted?: string
  ink?: string
  paper?: string
  accent?: string
  captionBg?: string
  promptTokens?: string[]
}

type Style = {
  mood: string
  do?: string[]
  dont?: string[]
  forbiddenClaims?: string[]
}

type Voice = {
  voiceId: string
  locale?: string
  speakingNotes?: string
  sampleLine?: string
}

const readJson = async <T>(filePath: string): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch (error) {
    throw new Error(
      `Brand kit incomplete: missing or invalid ${path.basename(filePath)} (${error instanceof Error ? error.message : 'read failed'})`,
    )
  }
}

export const loadBrandKitFiles = async (productId: string, repoRoot?: string, locale?: string) => {
  const root = brandKitRoot(productId, repoRoot)
  const [manifest, colors, style, voice, dnaRaw] = await Promise.all([
    readJson<Manifest>(path.join(root, 'manifest.json')),
    readJson<Colors>(path.join(root, 'colors.json')),
    readJson<Style>(path.join(root, 'style.json')),
    readJson<Voice>(path.join(root, 'voice.json')),
    readFile(path.join(root, 'dna.json'), 'utf8')
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => null),
  ])
  if (manifest.productId !== productId) {
    throw new Error(
      `Brand kit productId mismatch: expected ${productId}, got ${manifest.productId}`,
    )
  }
  const requiredRel = [manifest.logo.primary, ...(manifest.stills ?? [])]
  for (const rel of requiredRel) {
    try {
      await readFile(path.join(root, rel))
    } catch {
      throw new Error(`Brand kit incomplete: missing file ${rel}`)
    }
  }
  const dna = dnaRaw ? parseBrandDna(dnaRaw, productId) : null
  if (!locale) {
    return { root, manifest, colors, style, voice, dna }
  }
  const merged = await mergeBrandKitForLocale({
    kitRoot: root,
    locale,
    files: {
      'manifest.json': manifest as unknown as Record<string, unknown>,
      'colors.json': colors as unknown as Record<string, unknown>,
      'style.json': style as unknown as Record<string, unknown>,
      'voice.json': voice as unknown as Record<string, unknown>,
    },
  })
  return {
    root,
    manifest: merged['manifest.json'] as Manifest,
    colors: merged['colors.json'] as Colors,
    style: merged['style.json'] as Style,
    voice: merged['voice.json'] as Voice,
    dna,
  }
}

export const buildBrandPromptContext = (input: {
  productId: string
  manifest: Manifest
  colors: Colors
  style: Style
  voice: Voice
  dna?: BrandDna | null
}): BrandPromptContext => {
  const base = brandPromptContextSchema.parse({
    productId: input.productId,
    displayName: input.manifest.displayName,
    mood: input.style.mood,
    paletteHex: [
      input.colors.primary,
      input.colors.primaryMuted,
      input.colors.ink,
      input.colors.paper,
      input.colors.accent,
    ].filter((value): value is string => Boolean(value)),
    promptTokens: input.colors.promptTokens ?? [],
    forbiddenClaims: input.style.forbiddenClaims ?? [],
    doNotes: input.style.do ?? [],
    dontNotes: input.style.dont ?? [],
    voiceId: input.voice.voiceId,
    speakingNotes: input.voice.speakingNotes ?? '',
    defaultCta: input.manifest.defaultCta,
    neverFakeProductChrome: true,
  })
  return withBrandDna(base, input.dna)
}

const uploadKitFile = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  relPath: string
  absolutePath: string
  kind: 'image'
}): Promise<{ assetId: string; blobKey: string }> => {
  const bytes = await readFile(input.absolutePath)
  const assetId = randomUUID()
  const ext = path.extname(input.relPath).replace('.', '') || 'bin'
  const contentType =
    ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'application/octet-stream'
  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'brand-kit',
    parts: [
      input.projectId,
      assetId,
      `${path.basename(input.relPath, path.extname(input.relPath))}.${ext}`,
    ],
    data: bytes,
    contentType,
  })
  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.productId,
    project_id: input.projectId,
    kind: input.kind,
    source: 'brand_kit',
    blob_key: blobKey,
    content_type: contentType,
    probe: { brandKitPath: input.relPath },
  })
  if (error) {
    throw new Error(`Failed to register brand asset: ${error.message}`)
  }
  return { assetId, blobKey }
}

export const attachBrandKit = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  project: StudioProject
  productId: string
  persistAssets?: boolean
  repoRoot?: string
}): Promise<{ project: StudioProject; promptContext: BrandPromptContext }> => {
  const kit = await loadBrandKitFiles(
    input.productId,
    input.repoRoot,
    input.project.localization?.activeLocale,
  )
  const promptContext = buildBrandPromptContext({
    productId: input.productId,
    manifest: kit.manifest,
    colors: kit.colors,
    style: kit.style,
    voice: kit.voice,
    dna: kit.dna,
  })

  let logoAssetId: string | undefined
  let stillAssetId: string | undefined
  const assets = [...input.project.assets]

  if (input.persistAssets !== false) {
    const logo = await uploadKitFile({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId: input.productId,
      projectId: input.project.id,
      relPath: kit.manifest.logo.primary,
      absolutePath: path.join(kit.root, kit.manifest.logo.primary),
      kind: 'image',
    })
    logoAssetId = logo.assetId
    assets.push({
      id: logo.assetId,
      kind: 'image',
      blobKey: logo.blobKey,
      contentType: 'image/svg+xml',
      source: 'brand_kit',
      probe: { brandKitPath: kit.manifest.logo.primary },
    })

    const stillRel = kit.manifest.stills[0]
    if (stillRel) {
      const still = await uploadKitFile({
        supabase: input.supabase,
        blobEnv: input.blobEnv,
        productId: input.productId,
        projectId: input.project.id,
        relPath: stillRel,
        absolutePath: path.join(kit.root, stillRel),
        kind: 'image',
      })
      stillAssetId = still.assetId
      assets.push({
        id: still.assetId,
        kind: 'image',
        blobKey: still.blobKey,
        contentType: 'image/svg+xml',
        source: 'brand_kit',
        probe: { brandKitPath: stillRel },
      })
    }
  }

  const project = studioProjectSchema.parse({
    ...input.project,
    assets,
    brand: {
      productId: input.productId,
      logoAssetId,
      stillAssetId,
      primaryColor: kit.colors.primary,
      accentColor: kit.colors.accent,
      captionBg: kit.colors.captionBg,
      fontFamily: kit.manifest.fonts.display,
      voiceId: kit.voice.voiceId,
      defaultCta: kit.manifest.defaultCta,
      mood: kit.style.mood,
    },
    revision: input.project.revision + 1,
  })

  return { project, promptContext }
}

export const attachFallbackBrand = (input: {
  project: StudioProject
  productId: string
  displayName?: string
}): { project: StudioProject } => {
  const displayName = input.displayName?.trim() || input.productId
  const project = studioProjectSchema.parse({
    ...input.project,
    brand: {
      productId: input.productId,
      displayName,
      primaryColor: '#4c8dff',
      accentColor: '#6ba0ff',
      captionBg: 'rgba(12,14,17,0.72)',
      fontFamily: 'Syne',
      defaultCta: 'Learn more',
      mood: 'Clean operator chrome — fallback brand (no on-disk kit)',
    },
    revision: input.project.revision + 1,
  })
  return { project }
}

export const requireBrand = (project: StudioProject): NonNullable<StudioProject['brand']> => {
  if (!project.brand) {
    throw new Error('No project brand yet. Open Brand in the header to set logo and colors first.')
  }
  return project.brand
}
