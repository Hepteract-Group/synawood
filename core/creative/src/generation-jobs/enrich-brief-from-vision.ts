import { generateText as defaultGenerateText, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import {
  BRIEF_LOW_CONFIDENCE_THRESHOLD,
  parseExtractedBrief,
  type ExtractedBrief,
} from '../brief/extracted-brief'
import { isBrandWorthyColor, normalizeCssHex } from '../extract/css-colors'
import { reasonerAcceptsImageParts } from '../model-profiles/reasoner-models'
import { isNoLlmReasoner } from './estimate-extract'

const clipOptional = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return trimmed.slice(0, max)
  }, z.string().min(1).max(max).optional())

const clipRequiredList = (itemMax: number, minItems: number, maxItems: number) =>
  z.preprocess(
    (value) => {
      if (!Array.isArray(value)) return value
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, itemMax))
        .filter(Boolean)
        .slice(0, maxItems)
    },
    z.array(z.string().min(1).max(itemMax)).min(minItems).max(maxItems),
  )

/** Accept #RGB / #RRGGBB; reject UI slate chrome; normalize to #rrggbb. */
const brandHexOptional = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value
    const normalized = normalizeCssHex(value)
    if (!normalized || !isBrandWorthyColor(normalized)) return undefined
    return normalized
  },
  z
    .string()
    .regex(/^#[0-9a-f]{6}$/)
    .optional(),
)

const enrichmentSchema = z
  .object({
    displayName: clipOptional(80),
    tone: clipOptional(80),
    oneLiner: clipOptional(200),
    hookCandidates: clipRequiredList(120, 1, 8),
    ctaCandidates: clipRequiredList(60, 1, 6),
    styleNote: clipOptional(800),
    primaryColor: brandHexOptional,
    accentColor: brandHexOptional,
  })
  .strict()

export type BriefEnrichmentPatch = z.infer<typeof enrichmentSchema>

const extractJsonObject = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced?.[1] ?? text).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Enrichment response did not include a JSON object')
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown
}

/** Parse + clip model JSON so overlong fields soft-truncate instead of failing the job. */
export const parseEnrichmentPatch = (raw: unknown): BriefEnrichmentPatch =>
  enrichmentSchema.parse(raw)

/** Caption-role default. Known to accept screenshot file parts on Gateway. */
export const EXTRACT_VISION_FALLBACK_MODEL_ID = 'openai/gpt-4.1-mini'

/**
 * Screenshot enrichment must hit a VLM. Text-only Reason picks (Qwen / MiniMax / Muse)
 * otherwise 400 with DashScope `Unexpected item type in content` (ADR-0028).
 */
export const resolveEnrichmentVisionModelId = (reasonerModelId: string): string => {
  if (reasonerAcceptsImageParts(reasonerModelId)) return reasonerModelId
  return EXTRACT_VISION_FALLBACK_MODEL_ID
}

export const resolveEnrichmentModel = async (input: {
  reasonerModelId: string
  override?: LanguageModel
}): Promise<{ model: LanguageModel; visionModelId: string }> => {
  if (input.override) {
    return {
      model: input.override,
      visionModelId: resolveEnrichmentVisionModelId(input.reasonerModelId),
    }
  }
  if (isNoLlmReasoner(input.reasonerModelId)) {
    throw new Error('No LLM reasoner cannot run vision enrichment')
  }
  const visionModelId = resolveEnrichmentVisionModelId(input.reasonerModelId)
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    // Gateway accepts model id strings as LanguageModel in the AI SDK.
    return {
      model: visionModelId as unknown as LanguageModel,
      visionModelId,
    }
  }
  if (process.env.OPENAI_API_KEY?.trim() && visionModelId.startsWith('openai/')) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return {
      model: openai(visionModelId.replace(/^openai\//, '')),
      visionModelId,
    }
  }
  throw new Error('No AI Gateway or OpenAI credentials for extract enrichment')
}

export const mergeEnrichmentIntoBrief = (
  brief: ExtractedBrief,
  patch: BriefEnrichmentPatch,
): ExtractedBrief => {
  const displayName = patch.displayName?.trim() || brief.brandCandidates.displayName
  const defaultCta = patch.ctaCandidates[0]?.trim() || brief.brandCandidates.defaultCta
  const primaryColor = patch.primaryColor ?? brief.brandCandidates.primaryColor
  const accentColor = patch.accentColor ?? brief.brandCandidates.accentColor
  const fields = {
    ...(brief.confidence.fields ?? {}),
    'brandCandidates.displayName': displayName ? 0.85 : 0.4,
    'messaging.hookCandidates': 0.85,
    'messaging.ctaCandidates': 0.85,
    'messaging.tone': patch.tone ? 0.8 : (brief.confidence.fields?.['messaging.tone'] ?? 0.45),
    'product.oneLiner': patch.oneLiner
      ? 0.8
      : (brief.confidence.fields?.['product.oneLiner'] ?? 0.45),
    'brandCandidates.primaryColor': patch.primaryColor
      ? 0.9
      : (brief.confidence.fields?.['brandCandidates.primaryColor'] ?? 0.5),
    'brandCandidates.accentColor': patch.accentColor
      ? 0.85
      : (brief.confidence.fields?.['brandCandidates.accentColor'] ?? 0.45),
  }
  return parseExtractedBrief({
    ...brief,
    brandCandidates: {
      ...brief.brandCandidates,
      displayName,
      defaultCta,
      primaryColor,
      accentColor,
    },
    product: {
      ...brief.product,
      name: displayName || brief.product.name,
      oneLiner: patch.oneLiner?.trim() || brief.product.oneLiner,
    },
    messaging: {
      ...brief.messaging,
      hookCandidates: patch.hookCandidates.map((item) => item.trim()).filter(Boolean),
      ctaCandidates: patch.ctaCandidates.map((item) => item.trim()).filter(Boolean),
      tone: patch.tone?.trim() || brief.messaging.tone,
    },
    confidence: {
      overall: Math.min(0.92, Math.max(brief.confidence.overall, 0.75)),
      fields,
    },
    raw: [brief.raw, patch.styleNote ? `styleNote: ${patch.styleNote}` : undefined]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 50_000),
  })
}

/** Soft-fail: keep deterministic brief but mark messaging fields as low confidence. */
export const markEnrichmentSkipped = (brief: ExtractedBrief, warning: string): ExtractedBrief => {
  const fields = {
    ...(brief.confidence.fields ?? {}),
    'messaging.hookCandidates': Math.min(
      BRIEF_LOW_CONFIDENCE_THRESHOLD - 0.05,
      brief.confidence.fields?.['messaging.hookCandidates'] ?? 0.4,
    ),
    'messaging.ctaCandidates': Math.min(
      BRIEF_LOW_CONFIDENCE_THRESHOLD - 0.05,
      brief.confidence.fields?.['messaging.ctaCandidates'] ?? 0.4,
    ),
    'messaging.tone': Math.min(
      BRIEF_LOW_CONFIDENCE_THRESHOLD - 0.05,
      brief.confidence.fields?.['messaging.tone'] ?? 0.4,
    ),
  }
  return parseExtractedBrief({
    ...brief,
    confidence: {
      overall: Math.min(brief.confidence.overall, 0.5),
      fields,
    },
    raw: [brief.raw, `enrichmentSkipped: ${warning}`].filter(Boolean).join('\n\n').slice(0, 50_000),
  })
}

type VisionFilePart = {
  type: 'file'
  mediaType: string
  data: Buffer
  filename?: string
}

const imageFilePart = (input: {
  bytes: Buffer
  mediaType?: string
  filename: string
}): VisionFilePart => ({
  type: 'file',
  mediaType: input.mediaType?.startsWith('image/') ? input.mediaType : 'image/png',
  data: input.bytes,
  filename: input.filename,
})

type GenerateTextFn = typeof defaultGenerateText

export const enrichBriefFromVision = async (input: {
  brief: ExtractedBrief
  reasonerModelId: string
  digestText: string
  colorGuesses: string[]
  screenshotPng: Buffer
  logoBytes?: Buffer
  logoContentType?: string
  stillBytes?: Buffer
  stillContentType?: string
  modelOverride?: LanguageModel
  generateText?: GenerateTextFn
}): Promise<ExtractedBrief> => {
  const generate = input.generateText ?? defaultGenerateText
  const { model } = await resolveEnrichmentModel({
    reasonerModelId: input.reasonerModelId,
    override: input.modelOverride,
  })

  const system = `You refine a structured marketing ExtractedBrief from a product page screenshot and text digest.
Return ONLY a JSON object with keys: displayName?, tone?, oneLiner?, hookCandidates (1-8 short hooks), ctaCandidates (1-6 CTAs), styleNote?, primaryColor?, accentColor?.
Hooks must be punchy (<=90 chars), brand-specific, not generic filler. CTAs should be actionable.
styleNote must be <=750 characters. oneLiner <=180.
primaryColor and accentColor MUST be #RRGGBB hex for the brand's true identity colors (logo / hero / CTA), not grey UI chrome, not near-black/white. Prefer saturated brand hues visible in the screenshot or logo.`

  const userText = [
    `Current displayName: ${input.brief.brandCandidates.displayName ?? '(none)'}`,
    `Current primaryColor: ${input.brief.brandCandidates.primaryColor ?? '(none)'}`,
    `Current accentColor: ${input.brief.brandCandidates.accentColor ?? '(none)'}`,
    `CSS/logo color guesses: ${input.colorGuesses.join(', ') || '(none)'}`,
    `Digest (truncated):\n${input.digestText.slice(0, 6_000)}`,
  ].join('\n\n')

  const content: Array<{ type: 'text'; text: string } | VisionFilePart> = [
    { type: 'text', text: userText },
    imageFilePart({
      bytes: input.screenshotPng,
      mediaType: 'image/png',
      filename: 'page-screenshot.png',
    }),
  ]
  if (input.logoBytes?.byteLength) {
    content.push(
      imageFilePart({
        bytes: input.logoBytes,
        mediaType: input.logoContentType,
        filename: 'logo',
      }),
    )
  }
  if (input.stillBytes?.byteLength) {
    content.push(
      imageFilePart({
        bytes: input.stillBytes,
        mediaType: input.stillContentType,
        filename: 'still',
      }),
    )
  }

  const result = await generate({
    model,
    system,
    messages: [{ role: 'user', content }],
  })

  const patch = parseEnrichmentPatch(extractJsonObject(result.text))
  return mergeEnrichmentIntoBrief(input.brief, patch)
}
