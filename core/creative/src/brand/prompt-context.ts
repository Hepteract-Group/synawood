import { z } from 'zod'
import type { BrandDna } from './dna'

export const brandPromptContextSchema = z
  .object({
    productId: z.string().min(1),
    displayName: z.string().min(1),
    mood: z.string().min(1),
    paletteHex: z.array(z.string()).min(1),
    promptTokens: z.array(z.string()).default([]),
    forbiddenClaims: z.array(z.string()).default([]),
    doNotes: z.array(z.string()).default([]),
    dontNotes: z.array(z.string()).default([]),
    voiceId: z.string().min(1),
    speakingNotes: z.string().default(''),
    defaultCta: z.string().min(1),
    neverFakeProductChrome: z.literal(true).default(true),
    /** Optional Brand DNA (ADR-0044). Keep optional so existing literals typecheck. */
    tagline: z.string().max(200).optional(),
    icp: z.string().max(2000).optional(),
    values: z.array(z.string().max(80)).max(12).optional(),
    proofPoints: z.array(z.string().max(240)).max(12).optional(),
  })
  .strict()

export type BrandPromptContext = z.infer<typeof brandPromptContextSchema>

export const toBrandPromptBlock = (ctx: BrandPromptContext): string =>
  [
    `Brand: ${ctx.displayName} (${ctx.productId})`,
    ctx.tagline?.trim() ? `Tagline: ${ctx.tagline.trim()}` : null,
    `Mood: ${ctx.mood}`,
    `Palette: ${ctx.paletteHex.join(', ')}`,
    ctx.promptTokens.length ? `Style tokens: ${ctx.promptTokens.join(', ')}` : null,
    ctx.icp?.trim() ? `Ideal customer (who the product is for): ${ctx.icp.trim()}` : null,
    ctx.values?.length ? `Values: ${ctx.values.join('; ')}` : null,
    ctx.proofPoints?.length ? `Proof: ${ctx.proofPoints.join('; ')}` : null,
    `Voice: ${ctx.voiceId}. ${ctx.speakingNotes}`.trim(),
    `CTA: ${ctx.defaultCta}`,
    'Do not invent product UI; use provided Brand kit stills/references for UI.',
    ctx.forbiddenClaims.length ? `Forbidden claims: ${ctx.forbiddenClaims.join('; ')}` : null,
    ctx.dontNotes.length ? `Don't: ${ctx.dontNotes.join('; ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

export const withBrandDna = (
  ctx: BrandPromptContext,
  dna: BrandDna | null | undefined,
): BrandPromptContext => {
  if (!dna) return ctx
  return brandPromptContextSchema.parse({
    ...ctx,
    tagline: dna.tagline.trim() || ctx.tagline,
    icp: dna.icp.trim() || ctx.icp,
    values: dna.values.length ? dna.values : ctx.values,
    proofPoints: dna.proofPoints.length ? dna.proofPoints : ctx.proofPoints,
  })
}
