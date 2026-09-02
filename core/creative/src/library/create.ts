import { brandPromptContextFromProject } from '../brand/brand-ops'
import { brandPromptContextSchema } from '../brand/prompt-context'
import { generateImage } from '../generators/image'
import { isStubImageModelId } from '../model-profiles/image-models'
import { resolveModelRef } from '../model-profiles'
import { estimateGbp } from '../pricing'
import { enqueueGenerationJob, markGenerationJob } from '../generation-jobs/enqueue'
import { putBlob } from '../persistence/blob'
import type { StudioToolContext } from '../tools/types'
import { insertLibraryItem } from './insert'
import { parseEffectRecipe, parseGradeRecipe } from './recipes'
import { assertStickerHasAlpha } from './sticker-qc'
import type { LibraryCreatedBy, LibraryItem, LibraryKind } from './schema'

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

export type CreateLibraryItemInput = {
  kind: LibraryKind
  label: string
  prompt?: string
  recipe?: Record<string, unknown>
  confirmSpend?: boolean
  createdBy?: Exclude<LibraryCreatedBy, 'first-party'>
}

export const createLibraryItem = async (
  ctx: Pick<
    StudioToolContext,
    'productId' | 'projectId' | 'project' | 'blobEnv' | 'modelProfileId' | 'persist'
  > & {
    supabase?: StudioToolContext['supabase']
    confirmSpend?: boolean
  },
  input: CreateLibraryItemInput,
): Promise<LibraryItem> => {
  const createdBy = input.createdBy ?? 'agent'
  const recipe = resolveRecipe(input)

  if (input.kind === 'sticker') {
    return createStickerItem(ctx, { ...input, createdBy, recipe })
  }

  const itemShape: LibraryItem = {
    id: crypto.randomUUID(),
    productId: ctx.productId,
    kind: input.kind,
    label: input.label.trim(),
    source: 'generated',
    licenseStatus: 'unknown',
    commercialUseAllowed: false,
    recipe,
    blobKey: null,
    createdBy,
    createdAt: new Date().toISOString(),
  }

  if (!ctx.persist || !ctx.supabase) {
    return itemShape
  }

  return insertLibraryItem({
    supabase: ctx.supabase,
    id: itemShape.id,
    productId: ctx.productId,
    kind: input.kind,
    label: itemShape.label,
    source: 'generated',
    createdBy,
    recipe,
    blobKey: null,
  })
}

const resolveRecipe = (input: CreateLibraryItemInput): Record<string, unknown> => {
  if (input.kind === 'filter') {
    return parseGradeRecipe(input.recipe)
  }
  if (input.kind === 'effect') {
    return parseEffectRecipe(input.recipe)
  }
  if (input.kind === 'sticker') {
    const prompt = input.prompt?.trim()
    if (!prompt) {
      throw new Error('Sticker create needs a prompt (or import a PNG/WebP/SVG in the next slice).')
    }
    return { prompt }
  }
  return input.recipe ?? {}
}

const createStickerItem = async (
  ctx: Parameters<typeof createLibraryItem>[0],
  input: CreateLibraryItemInput & {
    createdBy: Exclude<LibraryCreatedBy, 'first-party'>
    recipe: Record<string, unknown>
  },
): Promise<LibraryItem> => {
  const model = resolveModelRef(ctx.modelProfileId, 'image')
  const estimatedGbp = estimateGbp(model.modelId, 1)
  const confirmed = Boolean(input.confirmSpend || ctx.confirmSpend)
  if (estimatedGbp > 0 && !confirmed) {
    throw new Error(
      `Generating this sticker would cost about £${estimatedGbp.toFixed(2)}. Pass confirmSpend=true to continue.`,
    )
  }

  const prompt = `${String(input.recipe.prompt)} Isolated sticker on a transparent background, PNG with alpha, not a full-frame poster.`
  const brand = ctx.project.brand
    ? brandPromptContextFromProject(ctx.project)
    : brandPromptContextSchema.parse({
        productId: ctx.productId,
        displayName: ctx.productId,
        mood: 'neutral',
        paletteHex: ['#666666'],
        voiceId: 'default',
        defaultCta: 'Learn more',
        neverFakeProductChrome: true,
      })
  const generated = isStubImageModelId(model.modelId)
    ? { bytes: TRANSPARENT_PNG, contentType: 'image/png' }
    : await generateImage({
        prompt,
        brand,
        aspectRatio: '1:1',
        modelId: model.modelId,
        referenceAssetIds: ctx.project.brand?.logoAssetId ? [ctx.project.brand.logoAssetId] : [],
      })
  const bytes = generated.bytes
  const contentType = generated.contentType || 'image/png'
  assertStickerHasAlpha({ bytes, contentType })

  const id = crypto.randomUUID()
  let blobKey: string | null = `memory/library/${ctx.productId}/sticker/${id}.png`
  if (ctx.persist && ctx.supabase) {
    const job = await enqueueGenerationJob(ctx.supabase, {
      productId: ctx.productId,
      projectId: ctx.projectId,
      role: 'image',
      modelId: model.modelId,
      modelProfileId: ctx.modelProfileId,
      estimatedGbp,
      units: 1,
      inputSnapshot: {
        libraryKind: 'sticker',
        label: input.label.trim(),
        prompt: input.recipe.prompt,
      },
    })
    try {
      await markGenerationJob(ctx.supabase, job.id, { status: 'generating', attempt_count: 1 })
      const uploaded = await putBlob({
        blobEnv: ctx.blobEnv,
        productId: ctx.productId,
        kind: 'library',
        parts: ['sticker', `${id}.png`],
        data: bytes,
        contentType,
      })
      blobKey = uploaded.blobKey
      const item = await insertLibraryItem({
        supabase: ctx.supabase,
        id,
        productId: ctx.productId,
        kind: 'sticker',
        label: input.label.trim(),
        source: 'generated',
        createdBy: input.createdBy,
        recipe: input.recipe,
        blobKey,
      })
      await markGenerationJob(ctx.supabase, job.id, { status: 'ready', actual_gbp: estimatedGbp })
      return item
    } catch (error) {
      await markGenerationJob(ctx.supabase, job.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Sticker generate failed',
      })
      throw error
    }
  }

  const item: LibraryItem = {
    id,
    productId: ctx.productId,
    kind: 'sticker',
    label: input.label.trim(),
    source: 'generated',
    licenseStatus: 'unknown',
    commercialUseAllowed: false,
    recipe: input.recipe,
    blobKey,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }

  if (!ctx.persist || !ctx.supabase) {
    return item
  }

  return insertLibraryItem({
    supabase: ctx.supabase,
    id,
    productId: ctx.productId,
    kind: 'sticker',
    label: item.label,
    source: 'generated',
    createdBy: input.createdBy,
    recipe: input.recipe,
    blobKey,
  })
}
