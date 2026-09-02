/** Product overlay library tools (ADR-0059 / #715). */

import { tool } from 'ai'
import { z } from 'zod'
import { listLibrary } from '../library/list'
import { createLibraryItem } from '../library/create'
import { importLibraryItem } from '../library/import'
import { libraryKindSchema } from '../library/schema'
import { wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolOk } from './types'

export const createLibraryTools = (ctx: StudioToolContext) => ({
  list_library: tool({
    description:
      'List overlay library items for this product: first-party packs plus generated/imported stickers, filters, effects, and presets. Optional kind filter. No spend.',
    inputSchema: z.object({
      kind: libraryKindSchema.optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'list_library', input, async () => {
        const items = await listLibrary({
          supabase: ctx.persist ? ctx.supabase : undefined,
          productId: ctx.productId,
          kind: input.kind,
        })
        return toolOk(`Listed ${items.length} library item(s)`, {
          items: items.map((item) => ({
            id: item.id,
            kind: item.kind,
            label: item.label,
            source: item.source,
            licenseStatus: item.licenseStatus,
            commercialUseAllowed: item.commercialUseAllowed,
            blobKey: item.blobKey,
          })),
        })
      }),
  }),

  create_library_item: tool({
    description:
      'Add a product library item. Filter: grade tokens (contrast/saturate/hueRotate/sepia/vignette). Effect: stack of shake/glow/flash/zoom_punch. Sticker: generate with transparency (confirmSpend if £>0). License starts unknown. No shaders or NLE projects.',
    inputSchema: z.object({
      kind: libraryKindSchema,
      label: z.string().trim().min(1).max(80),
      prompt: z.string().trim().min(1).max(500).optional(),
      recipe: z.record(z.string(), z.unknown()).optional(),
      confirmSpend: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'create_library_item', input, async () => {
        const item = await createLibraryItem(
          { ...ctx, confirmSpend: input.confirmSpend || ctx.confirmSpend },
          { ...input, createdBy: 'agent' },
        )
        return toolOk(`Saved ${item.kind} “${item.label}” to the product library`, {
          item: {
            id: item.id,
            kind: item.kind,
            label: item.label,
            source: item.source,
            licenseStatus: item.licenseStatus,
            commercialUseAllowed: item.commercialUseAllowed,
            blobKey: item.blobKey,
          },
        })
      }),
  }),

  import_library_item: tool({
    description:
      'Import a product library file: PNG/WebP/SVG sticker, licensed Lottie JSON, or JSON grade/treatment recipe. Rejects CapCut, Premiere, After Effects, GIF/GIPHY, and fonts. License starts unknown. Founder must clear commercial use. No spend.',
    inputSchema: z.object({
      fileName: z.string().trim().min(1).max(180),
      contentType: z.string().trim().min(1).max(80).optional(),
      jsonText: z.string().min(2).max(20_000).optional(),
      bytesBase64: z.string().min(8).max(2_000_000).optional(),
      label: z.string().trim().min(1).max(80).optional(),
      kind: libraryKindSchema.optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'import_library_item', input, async () => {
        const bytes = input.jsonText
          ? Buffer.from(input.jsonText, 'utf8')
          : input.bytesBase64
            ? Buffer.from(input.bytesBase64, 'base64')
            : null
        if (!bytes) {
          throw new Error('Pass jsonText for a recipe or bytesBase64 for a sticker file.')
        }
        const item = await importLibraryItem(ctx, {
          fileName: input.fileName,
          contentType: input.contentType ?? 'application/octet-stream',
          bytes,
          label: input.label,
          kind: input.kind,
          createdBy: 'import',
        })
        return toolOk(
          `Imported ${item.kind} “${item.label}” (license unknown until you clear it)`,
          {
            item: {
              id: item.id,
              kind: item.kind,
              label: item.label,
              source: item.source,
              licenseStatus: item.licenseStatus,
              commercialUseAllowed: item.commercialUseAllowed,
              blobKey: item.blobKey,
            },
          },
        )
      }),
  }),
})
