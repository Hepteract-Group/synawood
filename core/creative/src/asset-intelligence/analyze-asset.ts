/** Wave 2J / #585 — analyze_asset (ADR-0053). Library VLM + schema, same index. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText as defaultGenerateText, type LanguageModel } from 'ai'
import { resolveModelRef } from '../model-profiles'
import { getBlobBytes as getBlobBytesDefault, type BlobEnv } from '../persistence/blob'
import { estimateReasonerGbp } from '../pricing/estimate'
import { recordCostEvent } from '../pricing/ledger'
import { gateAssetIndexSpend } from './estimate-index'
import { replaceAssetAnalysis } from './analyze-persist'
import { commitSegmentShots } from './segment-shots'
import { fixtureAnalyzePackResult, resolveAnalyzePack } from './analyze-pack'
import { loadCompliancePromptContext } from './compliance-pack'
import {
  analyzeKindSchema,
  parseAnalyzeJsonResult,
  validateAnalyzeResult,
  type AnalyzeKind,
  type JsonSchemaObject,
} from './analyze-schema'
import { KEYFRAME_THUMBS_MISSING_PREFIX } from './thumbs-missing'
import type { TranscriptSegment } from './transcript'
import { transcriptWindowForShot } from './transcript'

export const MISSING_THUMBS_ANALYZE_ERROR =
  `${KEYFRAME_THUMBS_MISSING_PREFIX}. Retry index on this asset before analyze_asset.` as const

type GenerateTextFn = typeof defaultGenerateText

type ShotRow = {
  id: string
  startMs: number
  endMs: number | null
  thumbBlobKey: string | null
}

export type AnalyzeAssetResult = {
  assetId: string
  shotId: string | null
  startMs: number | null
  endMs: number | null
  kind: AnalyzeKind
  schemaId: string
  modelId: string
  result: Record<string, unknown>
}

const overlapping = (shot: ShotRow, startMs?: number, endMs?: number): boolean => {
  if (startMs == null && endMs == null) return true
  const shotEnd = shot.endMs ?? Number.POSITIVE_INFINITY
  const winStart = startMs ?? 0
  const winEnd = endMs ?? Number.POSITIVE_INFINITY
  return shot.startMs < winEnd && shotEnd > winStart
}

export const estimateAnalyzeGbp = (modelProfileId: string): number => {
  const caption = resolveModelRef(modelProfileId, 'caption')
  if (caption.modelId === 'mock-caption' || caption.modelId.startsWith('mock-')) return 0
  return estimateReasonerGbp(caption.modelId, { inputTokens: 1600, outputTokens: 400 })
}

const loadAssetShots = async (input: {
  supabase: SupabaseClient
  productId: string
  assetId: string
}): Promise<{
  kind: string
  shots: ShotRow[]
  transcriptExcerpt: string | null
  segments: TranscriptSegment[]
}> => {
  const { data: asset, error: assetError } = await input.supabase
    .from('assets')
    .select('id, kind')
    .eq('product_id', input.productId)
    .eq('id', input.assetId)
    .maybeSingle()
  if (assetError) throw new Error(`analyze_asset failed: ${assetError.message}`)
  if (!asset) throw new Error(`No asset ${input.assetId} in this product`)

  const [{ data: shotRows, error: shotError }, { data: state, error: stateError }] =
    await Promise.all([
      input.supabase
        .from('asset_shots')
        .select('id, start_ms, end_ms, thumb_blob_key')
        .eq('product_id', input.productId)
        .eq('asset_id', input.assetId)
        .order('ordinal', { ascending: true }),
      input.supabase
        .from('asset_index_state')
        .select('transcript_excerpt, transcript_segments')
        .eq('product_id', input.productId)
        .eq('asset_id', input.assetId)
        .maybeSingle(),
    ])
  if (shotError) throw new Error(`analyze_asset failed: ${shotError.message}`)
  if (stateError) throw new Error(`analyze_asset failed: ${stateError.message}`)

  return {
    kind: asset.kind as string,
    shots: (shotRows ?? []).map((row) => ({
      id: row.id as string,
      startMs: row.start_ms as number,
      endMs: (row.end_ms as number | null) ?? null,
      thumbBlobKey: (row.thumb_blob_key as string | null) ?? null,
    })),
    transcriptExcerpt: (state?.transcript_excerpt as string | null) ?? null,
    segments: Array.isArray(state?.transcript_segments)
      ? (state.transcript_segments as TranscriptSegment[])
      : [],
  }
}

export const analyzeAsset = async (
  input: {
    supabase: SupabaseClient
    blobEnv?: BlobEnv
    productId: string
    projectId?: string | null
    modelProfileId: string
    assetId: string
    shotId?: string
    startMs?: number
    endMs?: number
    prompt: string
    schema?: JsonSchemaObject
    kind?: AnalyzeKind
    schemaId?: string
    confirmSpend?: boolean
    persist?: boolean
    spentThisMonthGbp?: number
    spentThisWeekGbp?: number
    spentThisProjectGbp?: number
  },
  deps?: {
    getBlobBytes?: typeof getBlobBytesDefault
    generateText?: GenerateTextFn
  },
): Promise<AnalyzeAssetResult> => {
  const kind = analyzeKindSchema.parse(input.kind ?? 'custom')
  const compliance =
    kind === 'compliance'
      ? await loadCompliancePromptContext({
          productId: input.productId,
          supabase: input.supabase,
        })
      : undefined
  const pack = resolveAnalyzePack({
    kind,
    schema: input.schema,
    prompt: input.prompt,
    compliance,
  })
  const schema = pack.schema
  const prompt = pack.prompt
  const schemaId = kind === 'custom' ? input.schemaId?.trim() || pack.schemaId : pack.schemaId
  const caption = resolveModelRef(input.modelProfileId, 'caption')

  const loaded = await loadAssetShots({
    supabase: input.supabase,
    productId: input.productId,
    assetId: input.assetId,
  })

  const selected = input.shotId
    ? loaded.shots.filter((shot) => shot.id === input.shotId)
    : loaded.shots.filter((shot) => overlapping(shot, input.startMs, input.endMs)).slice(0, 8)

  if (selected.length === 0 || selected.some((shot) => !shot.thumbBlobKey)) {
    throw new Error(MISSING_THUMBS_ANALYZE_ERROR)
  }

  const estimatedGbp = estimateAnalyzeGbp(input.modelProfileId)
  if (estimatedGbp > 0 && !input.confirmSpend) {
    throw new Error(
      `Estimated £${estimatedGbp.toFixed(4)} needs confirmSpend=true before analyze_asset.`,
    )
  }
  const gate = gateAssetIndexSpend({
    estimatedGbp,
    spentThisMonthGbp: input.spentThisMonthGbp ?? 0,
    spentThisWeekGbp: input.spentThisWeekGbp ?? 0,
    spentThisProjectGbp: input.spentThisProjectGbp ?? 0,
    confirmSpend: input.confirmSpend,
  })
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const startMs = input.startMs ?? selected[0]?.startMs ?? null
  const endMs = input.endMs ?? selected.at(-1)?.endMs ?? null
  const shotId = input.shotId ?? (selected.length === 1 ? selected[0]!.id : null)
  const excerpt =
    loaded.segments.length > 0
      ? transcriptWindowForShot({ startMs: startMs ?? 0, endMs }, loaded.segments)
      : loaded.transcriptExcerpt

  let data: Record<string, unknown>
  if (caption.modelId === 'mock-caption' || caption.modelId.startsWith('mock-')) {
    data = fixtureAnalyzePackResult({ kind, schema })
  } else {
    if (!input.blobEnv) {
      throw new Error('analyze_asset needs Blob env to load keyframe thumbs')
    }
    const getBytes = deps?.getBlobBytes ?? getBlobBytesDefault
    const frames = await Promise.all(
      selected.map(async (shot) => ({
        shotId: shot.id,
        bytes: await getBytes({ blobEnv: input.blobEnv!, blobKey: shot.thumbBlobKey! }),
      })),
    )
    const generate = deps?.generateText ?? defaultGenerateText
    const result = await generate({
      model: caption.modelId as unknown as LanguageModel,
      system: `You analyze marketing library media. Return ONLY JSON matching the provided schema. No markdown.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${prompt}\n\nJSON schema:\n${JSON.stringify(schema)}\n\nWindow: ${startMs ?? 0}–${endMs ?? 'end'} ms.${excerpt ? `\nTranscript excerpt:\n${excerpt}` : ''}`,
            },
            ...frames.map((frame) => ({
              type: 'file' as const,
              mediaType: 'image/jpeg',
              data: frame.bytes,
              filename: `${frame.shotId}.jpg`,
            })),
          ],
        },
      ],
    })
    data = validateAnalyzeResult(parseAnalyzeJsonResult(result.text), schema)
  }

  const result = data

  if (input.persist !== false) {
    await replaceAssetAnalysis(input.supabase, {
      assetId: input.assetId,
      productId: input.productId,
      shotId,
      kind,
      schemaId,
      result,
      modelId: caption.modelId,
      startMs,
      endMs,
    })
    if (estimatedGbp > 0) {
      await recordCostEvent(input.supabase, {
        productId: input.productId,
        projectId: input.projectId ?? undefined,
        role: 'analyze',
        modelId: caption.modelId,
        units: 1,
        estimatedGbp,
        actualGbp: estimatedGbp,
      })
    }
    if (kind === 'segment') {
      await commitSegmentShots({
        supabase: input.supabase,
        assetId: input.assetId,
        productId: input.productId,
        result,
        blobEnv: input.blobEnv,
        modelProfileId: input.modelProfileId,
      })
    }
  }

  return {
    assetId: input.assetId,
    shotId,
    startMs,
    endMs,
    kind,
    schemaId,
    modelId: caption.modelId,
    result,
  }
}
