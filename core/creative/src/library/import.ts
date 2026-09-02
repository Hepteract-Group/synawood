import { parseCubeLut } from './cube'
import { sanitizeSvgBytes } from '../persistence/sanitize-svg'
import { putBlob } from '../persistence/blob'
import type { StudioToolContext } from '../tools/types'
import { insertLibraryItem } from './insert'
import { isLottieJson, rejectLibraryImportFile } from './import-guards'
import { parseEffectRecipe, parseGradeRecipe } from './recipes'
import { assertStickerHasAlpha } from './sticker-qc'
import type { LibraryItem, LibraryKind } from './schema'

export type ImportLibraryItemInput = {
  fileName: string
  contentType: string
  bytes: Uint8Array
  label?: string
  kind?: LibraryKind
  createdBy?: 'user' | 'import'
}

const labelFromFile = (fileName: string): string =>
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 80) || 'Imported'

export const importLibraryItem = async (
  ctx: Pick<StudioToolContext, 'productId' | 'blobEnv' | 'persist'> & {
    supabase?: StudioToolContext['supabase']
  },
  input: ImportLibraryItemInput,
): Promise<LibraryItem> => {
  const rejected = rejectLibraryImportFile(input.fileName, input.contentType)
  if (rejected) {
    throw new Error(rejected.error)
  }

  const type = input.contentType.toLowerCase()
  const name = input.fileName.toLowerCase()
  const isJson = type.includes('json') || name.endsWith('.json')
  const isSvg = type.includes('svg') || name.endsWith('.svg')
  const isCube = type.includes('cube') || name.endsWith('.cube')
  const isRaster =
    type.includes('png') || type.includes('webp') || name.endsWith('.png') || name.endsWith('.webp')

  if (isJson) {
    return importJsonRecipe(ctx, input)
  }
  if (isCube) {
    return importCubeLut(ctx, input)
  }
  if (isSvg || isRaster) {
    return importStickerFile(ctx, input, isSvg)
  }
  throw new Error(
    'Import a PNG, WebP, or SVG sticker, a JSON grade / treatment recipe, or a .cube LUT. NLE projects are not supported.',
  )
}

const importCubeLut = async (
  ctx: Parameters<typeof importLibraryItem>[0],
  input: ImportLibraryItemInput,
): Promise<LibraryItem> => {
  const lut = parseCubeLut(Buffer.from(input.bytes).toString('utf8'), input.fileName)
  return persistImported(ctx, {
    kind: 'filter',
    label: input.label?.trim() || lut.title,
    recipe: lut,
    blobKey: null,
    createdBy: input.createdBy ?? 'import',
  })
}

const importJsonRecipe = async (
  ctx: Parameters<typeof importLibraryItem>[0],
  input: ImportLibraryItemInput,
): Promise<LibraryItem> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(input.bytes).toString('utf8'))
  } catch {
    throw new Error('JSON import is not valid JSON.')
  }
  if (isLottieJson(parsed)) {
    return persistImported(ctx, {
      kind: 'sticker',
      label: input.label?.trim() || labelFromFile(input.fileName),
      recipe: { format: 'lottie', animationData: parsed },
      blobKey: null,
      createdBy: input.createdBy ?? 'import',
    })
  }

  const asEffect = (() => {
    try {
      return parseEffectRecipe(parsed)
    } catch {
      return null
    }
  })()
  const asGrade = (() => {
    try {
      return parseGradeRecipe(parsed)
    } catch {
      return null
    }
  })()

  const kind: LibraryKind = input.kind ?? (asEffect ? 'effect' : 'filter')
  const recipe =
    kind === 'effect'
      ? (asEffect ?? parseEffectRecipe(parsed))
      : (asGrade ?? parseGradeRecipe(parsed))

  return persistImported(ctx, {
    kind,
    label: input.label?.trim() || labelFromFile(input.fileName),
    recipe,
    blobKey: null,
    createdBy: input.createdBy ?? 'import',
  })
}

const importStickerFile = async (
  ctx: Parameters<typeof importLibraryItem>[0],
  input: ImportLibraryItemInput,
  isSvg: boolean,
): Promise<LibraryItem> => {
  let bytes: Buffer = Buffer.from(input.bytes)
  let contentType = input.contentType || (isSvg ? 'image/svg+xml' : 'image/png')
  if (isSvg) {
    bytes = Buffer.from(sanitizeSvgBytes(bytes))
    contentType = 'image/svg+xml'
  }
  assertStickerHasAlpha({ bytes, contentType })

  const id = crypto.randomUUID()
  const ext = isSvg ? 'svg' : contentType.includes('webp') ? 'webp' : 'png'
  let blobKey: string | null = `memory/library/${ctx.productId}/sticker/${id}.${ext}`
  if (ctx.persist) {
    const uploaded = await putBlob({
      blobEnv: ctx.blobEnv,
      productId: ctx.productId,
      kind: 'library',
      parts: ['sticker', `${id}.${ext}`],
      data: bytes,
      contentType,
    })
    blobKey = uploaded.blobKey
  }

  return persistImported(ctx, {
    kind: 'sticker',
    label: input.label?.trim() || labelFromFile(input.fileName),
    recipe: { fileName: input.fileName },
    blobKey,
    createdBy: input.createdBy ?? 'import',
    id,
  })
}

const persistImported = async (
  ctx: Parameters<typeof importLibraryItem>[0],
  input: {
    id?: string
    kind: LibraryKind
    label: string
    recipe: Record<string, unknown>
    blobKey: string | null
    createdBy: 'user' | 'import'
  },
): Promise<LibraryItem> => {
  const item: LibraryItem = {
    id: input.id ?? crypto.randomUUID(),
    productId: ctx.productId,
    kind: input.kind,
    label: input.label,
    source: 'imported',
    licenseStatus: 'unknown',
    commercialUseAllowed: false,
    recipe: input.recipe,
    blobKey: input.blobKey,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  if (!ctx.persist || !ctx.supabase) {
    return item
  }
  return insertLibraryItem({
    supabase: ctx.supabase,
    id: item.id,
    productId: ctx.productId,
    kind: item.kind,
    label: item.label,
    source: 'imported',
    createdBy: input.createdBy,
    recipe: item.recipe,
    blobKey: item.blobKey,
  })
}
