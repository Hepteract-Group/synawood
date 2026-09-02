import { humanizeStudioError } from './humanize-studio-error'

export type GenerationJobLineInput = {
  id: string
  status: 'queued' | 'generating' | 'ready' | 'failed'
  role: string
  errorMessage: string | null
  libraryKind?: string | null
  aspect?: string | null
  extractKind?: string | null
}

/** Library indexing has its own Media-bin chip. Do not reuse Studio generation chrome. */
export const isOperatorFacingGenerationRole = (role: string): boolean => role !== 'index'

export const operatorFacingGenerationJobs = <T extends { role: string }>(jobs: readonly T[]): T[] =>
  jobs.filter((job) => isOperatorFacingGenerationRole(job.role))

export const newInFlightJobIds = (
  currentIds: readonly string[],
  alreadySeen: ReadonlySet<string>,
): string[] => currentIds.filter((id) => !alreadySeen.has(id))

/** Pulse the toast only for jobs the operator has not already been told about. */
export const shouldShowGenerationToast = (input: {
  newInFlightIds: readonly string[]
  unseenFailedIds: readonly string[]
}): boolean => input.newInFlightIds.length > 0 || input.unseenFailedIds.length > 0

export const GENERATION_TOAST_MS = 4000

const kindLabel = (
  job: Pick<GenerationJobLineInput, 'role' | 'libraryKind' | 'aspect'>,
): {
  singular: string
  plural: string
} => {
  if (job.role === 'reframe') {
    const aspect = job.aspect ?? '9:16'
    return { singular: `reframe to ${aspect}`, plural: `reframes to ${aspect}` }
  }
  if (job.libraryKind === 'sticker') return { singular: 'sticker', plural: 'stickers' }
  if (job.role === 'image') return { singular: 'slide background', plural: 'slide backgrounds' }
  if (job.role === 'video') return { singular: 'video clip', plural: 'video clips' }
  if (job.role === 'music') return { singular: 'music bed', plural: 'music beds' }
  if (job.role === 'speech' || job.role.startsWith('voice_'))
    return { singular: 'voice', plural: 'voice jobs' }
  if (job.role === 'extract') return { singular: 'extract', plural: 'extracts' }
  if (job.role === 'transcribe') return { singular: 'transcript', plural: 'transcripts' }
  if (job.role === 'speech_enhance') {
    return { singular: 'speech enhance', plural: 'speech enhance jobs' }
  }
  const fallback = job.role.replaceAll('_', ' ')
  return { singular: fallback, plural: `${fallback} jobs` }
}

export const formatGenerationJobLine = (job: GenerationJobLineInput): string => {
  const { singular } = kindLabel(job)
  if (job.status === 'failed') {
    const detail = job.errorMessage ? `: ${humanizeStudioError(job.errorMessage)}` : ''
    return `${singular.charAt(0).toUpperCase()}${singular.slice(1)} failed${detail}`
  }
  if (job.role === 'reframe') {
    if (job.status === 'generating') return `Reframing take to ${job.aspect ?? '9:16'}…`
    return `Reframe to ${job.aspect ?? '9:16'} queued…`
  }
  if (job.status === 'generating') return `Generating ${singular}…`
  return `${singular.charAt(0).toUpperCase()}${singular.slice(1)} queued…`
}

export const summarizeInFlightGeneration = (jobs: readonly GenerationJobLineInput[]): string => {
  if (jobs.length === 0) return ''
  if (jobs.length === 1) return formatGenerationJobLine(jobs[0]!)
  const keys = new Set(
    jobs.map((job) => `${job.role}:${job.libraryKind ?? ''}:${job.aspect ?? ''}`),
  )
  if (keys.size === 1) {
    const { plural } = kindLabel(jobs[0]!)
    const allQueued = jobs.every((job) => job.status === 'queued')
    if (allQueued) return `${jobs.length} ${plural} queued…`
    return `Generating ${jobs.length} ${plural}…`
  }
  return `Working on ${jobs.length} jobs…`
}
