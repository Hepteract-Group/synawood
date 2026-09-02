/** Voice Studio DTOs (ADR-0033 / #214). */

import { z } from 'zod'

export const voiceProfileKindSchema = z.enum(['synth', 'clone'])
export type VoiceProfileKind = z.infer<typeof voiceProfileKindSchema>

export const voiceEventKindSchema = z.enum(['synth', 'clone', 'dub', 'lipsync', 'fillers'])
export type VoiceEventKind = z.infer<typeof voiceEventKindSchema>

export const voiceProvenanceKindSchema = z.enum(['synth', 'clone', 'dub', 'lipsync'])
export type VoiceProvenanceKind = z.infer<typeof voiceProvenanceKindSchema>

export const voiceProfileSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1),
    name: z.string().min(1).max(80),
    locale: z.string().min(2).max(16).default('en'),
    kind: voiceProfileKindSchema.default('synth'),
    providerVoiceId: z.string().max(120).nullable(),
    sampleBlobKey: z.string().max(400).nullable(),
    consentAt: z.string().datetime().nullable(),
    consentSource: z.string().max(200).nullable(),
    status: z.enum(['active', 'archived']).default('active'),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type VoiceProfile = z.infer<typeof voiceProfileSchema>

export const voiceProvenanceSchema = z
  .object({
    kind: voiceProvenanceKindSchema,
    profileId: z.string().uuid().optional(),
    consentAt: z.string().datetime().optional(),
    modelId: z.string().min(1),
    stub: z.boolean().optional(),
  })
  .strict()

export type VoiceProvenance = z.infer<typeof voiceProvenanceSchema>

export const cutRangeSchema = z
  .object({
    from: z.number().int().nonnegative(),
    durationInFrames: z.number().int().positive(),
  })
  .strict()

export type CutRange = z.infer<typeof cutRangeSchema>

export const cutReasonSchema = z.enum(['filler', 'pause', 'retake', 'clarity'])
export type CutReason = z.infer<typeof cutReasonSchema>

export const timedCutSchema = z
  .object({
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    reason: cutReasonSchema,
  })
  .strict()
  .refine((cut) => cut.endMs > cut.startMs, { message: 'endMs must be after startMs' })

export type TimedCut = z.infer<typeof timedCutSchema>

export const cutListItemSchema = z.union([cutRangeSchema, timedCutSchema])
export type CutListItem = z.infer<typeof cutListItemSchema>

export const toIsoDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${value}`)
  }
  return date.toISOString()
}

export const voiceProfileFromRow = (row: {
  id: string
  product_id: string
  name: string
  locale: string
  kind: string
  provider_voice_id: string | null
  sample_blob_key?: string | null
  consent_at: string | null
  consent_source: string | null
  status: string
  created_at: string
  updated_at: string
}): VoiceProfile =>
  voiceProfileSchema.parse({
    id: row.id,
    productId: row.product_id,
    name: row.name,
    locale: row.locale,
    kind: row.kind,
    providerVoiceId: row.provider_voice_id,
    sampleBlobKey: row.sample_blob_key ?? null,
    consentAt: row.consent_at ? toIsoDateTime(row.consent_at) : null,
    consentSource: row.consent_source,
    status: row.status,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  })

export const isMockVoiceModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') || modelId === 'disabled'

export const parseVoiceProvenance = (probe: Record<string, unknown> | undefined | null) => {
  const raw = probe?.voiceProvenance
  const parsed = voiceProvenanceSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Distinguish missing vs invalid so Approve can fail closed on unknown kinds. */
export const readVoiceProvenance = (
  probe: Record<string, unknown> | undefined | null,
): { status: 'none' } | { status: 'invalid' } | { status: 'ok'; value: VoiceProvenance } => {
  const raw = probe?.voiceProvenance
  if (raw == null) return { status: 'none' }
  const parsed = voiceProvenanceSchema.safeParse(raw)
  if (!parsed.success) return { status: 'invalid' }
  return { status: 'ok', value: parsed.data }
}

export const voiceProvenanceBadgeLabel = (
  probe: Record<string, unknown> | undefined | null,
): string | null => {
  const parsed = parseVoiceProvenance(probe)
  if (!parsed) return null
  const label =
    parsed.kind === 'synth'
      ? 'Synth'
      : parsed.kind === 'clone'
        ? 'Clone'
        : parsed.kind === 'dub'
          ? 'Dub'
          : 'Lip-sync'
  return parsed.stub || isMockVoiceModelId(parsed.modelId) ? `Mock · ${label}` : label
}

export const CLONE_SAMPLE_REQUIRED_MESSAGE =
  'Clone this voice first. Record or upload a sample in Settings → Voice, then save the profile.'

export const CLONE_CONSENT_REQUIRED_MESSAGE =
  'Clone voice requires recorded consent. Check the consent box in Settings → Voice.'

export const voiceOperatorError = (message: string): Error => {
  const error = new Error(message)
  error.name = 'VoiceOperatorError'
  return error
}

export const isVoiceOperatorError = (error: unknown): error is Error =>
  error instanceof Error && error.name === 'VoiceOperatorError'

export const assertCloneConsent = (profile: Pick<VoiceProfile, 'kind' | 'consentAt'>): void => {
  if (profile.kind === 'clone' && !profile.consentAt) {
    throw voiceOperatorError(CLONE_CONSENT_REQUIRED_MESSAGE)
  }
}

export const isCloneProfileReady = (
  profile: Pick<VoiceProfile, 'kind' | 'consentAt' | 'sampleBlobKey' | 'providerVoiceId'>,
): boolean =>
  profile.kind === 'clone' &&
  Boolean(profile.consentAt) &&
  Boolean(profile.sampleBlobKey?.trim()) &&
  Boolean(profile.providerVoiceId?.trim())

export const assertCloneReady = (
  profile: Pick<VoiceProfile, 'kind' | 'consentAt' | 'sampleBlobKey' | 'providerVoiceId'>,
): void => {
  assertCloneConsent(profile)
  if (profile.kind !== 'clone') return
  if (!profile.sampleBlobKey?.trim()) {
    throw voiceOperatorError(CLONE_SAMPLE_REQUIRED_MESSAGE)
  }
  if (!profile.providerVoiceId?.trim()) {
    throw voiceOperatorError(
      'Clone is missing a provider voice. Save the profile again after recording a sample.',
    )
  }
}
