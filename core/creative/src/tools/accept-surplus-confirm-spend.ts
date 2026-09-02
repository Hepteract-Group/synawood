import type { ToolSet } from 'ai'
import { z } from 'zod'

/**
 * MiniMax (and similar) copies confirmSpend onto every tool because paid-tool
 * descriptions mention it. Session spend is already on ctx.confirmSpend.
 * JSON Schema additionalProperties:false then rejects the extra key *before*
 * execute, and Intent .strict() rejects it *inside* set_intent.
 * Declare the field so providers accept it, then drop it when the tool
 * never asked for it.
 */
const confirmSpendField = z.boolean().optional()

/** Tools whose execute reads input.confirmSpend (session ctx still wins). */
export const TOOLS_KEEPING_CONFIRM_SPEND = new Set([
  'analyze_asset',
  'captions_from_transcript',
  'commit_broll_plan',
  'create_library_item',
  'dub_project_for_locale',
  'enhance_speech',
  'extract_product_pages',
  'generate_campaign_creatives',
  'generate_music',
  'generate_voiceover',
  'generate_video_clip',
  'plan_variants',
  'reframe_clip',
  'render_variants',
  'synthesize_voice',
  'transcribe_media',
  'translate_all_missing',
  'translate_and_dub',
])

/** Mutate the same object execute closed over — generateText may skip our execute wrapper. */
export const dropSurplusConfirmSpendInPlace = (
  toolName: string,
  input: Record<string, unknown>,
): void => {
  if (!('confirmSpend' in input)) return
  if (TOOLS_KEEPING_CONFIRM_SPEND.has(toolName)) return
  delete input.confirmSpend
}

const isZodObject = (schema: unknown): schema is z.ZodObject<z.ZodRawShape> =>
  typeof schema === 'object' &&
  schema !== null &&
  'shape' in schema &&
  typeof (schema as { extend?: unknown }).extend === 'function'

const dropConfirmSpend = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
  if (!('confirmSpend' in value)) return value
  const { confirmSpend: _ignored, ...rest } = value as Record<string, unknown>
  return rest
}

const schemaDeclaresConfirmSpend = (schema: z.ZodType): boolean => {
  if (isZodObject(schema) && 'confirmSpend' in schema.shape) return true
  try {
    const json = z.toJSONSchema(schema) as { properties?: Record<string, unknown> }
    return Boolean(json.properties && 'confirmSpend' in json.properties)
  } catch {
    return false
  }
}

export const toolsAcceptingSurplusConfirmSpend = (tools: ToolSet): ToolSet => {
  const next: ToolSet = { ...tools }
  for (const [name, entry] of Object.entries(tools)) {
    const schema = entry.inputSchema
    if (!schema || typeof schema !== 'object') continue
    const zodSchema = schema as z.ZodType
    const declares = schemaDeclaresConfirmSpend(zodSchema)
    const inputSchema = declares
      ? zodSchema
      : isZodObject(zodSchema)
        ? zodSchema.extend({ confirmSpend: confirmSpendField })
        : z.preprocess(dropConfirmSpend, zodSchema)
    const originalExecute = entry.execute
    next[name] = {
      ...entry,
      inputSchema,
      execute: originalExecute
        ? async (input, options) => {
            const cleaned = declares ? input : dropConfirmSpend(input)
            return originalExecute(cleaned as never, options)
          }
        : originalExecute,
    }
  }
  return next
}
