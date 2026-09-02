/** Wave 2C / #165 — caption + tags via profile `caption` VLM. */

import { createOpenAI } from '@ai-sdk/openai'
import { generateText as defaultGenerateText, type LanguageModel } from 'ai'
import { z } from 'zod'

const MAX_TAGS = 12
const MAX_TAG_LEN = 64
const MAX_CAPTION_LEN = 600

export const normalizeAssetTag = (raw: string): string | null => {
  const tag = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!tag || tag.length > MAX_TAG_LEN) return null
  return tag
}

export const normalizeAssetTags = (raw: readonly string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const tag = normalizeAssetTag(item)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

const captionResultSchema = z
  .object({
    caption: z.string().trim().min(1).max(MAX_CAPTION_LEN),
    tags: z.array(z.string()).max(24).optional(),
  })
  .strict()

const extractJsonObject = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced?.[1] ?? text).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Caption VLM response did not include a JSON object')
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown
}

export const parseCaptionVlmResult = (text: string): { caption: string; tags: string[] } => {
  const parsed = captionResultSchema.parse(extractJsonObject(text))
  return {
    caption: parsed.caption.slice(0, MAX_CAPTION_LEN),
    tags: normalizeAssetTags(parsed.tags ?? []),
  }
}

export type CaptionAssetResult =
  { skipped: false; caption: string; tags: string[] } | { skipped: true; reason: string }

type VisionFilePart = {
  type: 'file'
  mediaType: string
  data: Buffer
  filename?: string
}

type GenerateTextFn = typeof defaultGenerateText

const resolveCaptionModel = async (input: {
  modelId: string
  override?: LanguageModel
}): Promise<LanguageModel> => {
  if (input.override) return input.override
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return input.modelId as unknown as LanguageModel
  }
  if (process.env.OPENAI_API_KEY?.trim() && input.modelId.startsWith('openai/')) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return openai(input.modelId.replace(/^openai\//, ''))
  }
  throw new Error('No AI Gateway or OpenAI credentials for asset caption')
}

/**
 * Caption one asset frame/still. Videos without keyframe thumbs skip (soft)
 * until shot thumbs land — ADR-0032 stages are skippable when inputs missing.
 */
export const captionAssetWithVlm = async (
  input: {
    modelId: string
    kind: 'video' | 'image' | 'audio' | 'other'
    mediaType: string
    fileName: string
    bytes: Buffer
    modelOverride?: LanguageModel
  },
  deps?: { generateText?: GenerateTextFn },
): Promise<CaptionAssetResult> => {
  if (input.modelId === 'mock-caption' || input.modelId.startsWith('mock-')) {
    return {
      skipped: false,
      caption: `Mock caption for ${input.fileName || 'asset'}`,
      tags: normalizeAssetTags(['mock', input.kind]),
    }
  }

  const isImage = input.kind === 'image' || input.mediaType.startsWith('image/')
  if (!isImage) {
    return {
      skipped: true,
      reason: 'caption skipped: no keyframe image yet (video/audio wait for shot thumbs)',
    }
  }

  const generate = deps?.generateText ?? defaultGenerateText
  // Injected generateText (tests) may skip real credentials; still need a model handle.
  const model =
    deps?.generateText && !input.modelOverride
      ? (input.modelId as unknown as LanguageModel)
      : await resolveCaptionModel({
          modelId: input.modelId,
          override: input.modelOverride,
        })

  const system = `You label marketing media for retrieval.
Return ONLY a JSON object: {"caption":"<1-2 sentences>","tags":["tag",...]}.
caption: concrete visual description (<=500 chars). tags: 3-8 short lowercase retrieval tags (subjects, setting, vibe). No markdown.`

  const filePart: VisionFilePart = {
    type: 'file',
    mediaType: input.mediaType.startsWith('image/') ? input.mediaType : 'image/png',
    data: input.bytes,
    filename: input.fileName || 'asset',
  }

  const result = await generate({
    model,
    system,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Describe this ${input.kind} asset for a media library search.` },
          filePart,
        ],
      },
    ],
  })

  const parsed = parseCaptionVlmResult(result.text)
  return { skipped: false, caption: parsed.caption, tags: parsed.tags }
}
