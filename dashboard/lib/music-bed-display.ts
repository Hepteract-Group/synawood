export const formatMusicEstimateLabel = (input: {
  estimatedGbp: number | null
  stub?: boolean
}): string => {
  if (input.estimatedGbp == null) return '…'
  if (input.stub) return '£0 (stub)'
  return `~£${input.estimatedGbp.toFixed(2)}`
}

export type MusicBannerTone = 'ok' | 'warn' | null

export type MusicJobRecovery = {
  kind: 'ready' | 'failed' | 'in_progress' | 'unverified' | 'silent'
  banner: string | null
  bannerTone: MusicBannerTone
  clearPending: boolean
  reload: boolean
}

export const displayMusicBedTitle = (
  prompt: string | null | undefined,
  snapshot?: { userPrompt?: unknown } | null,
): string => {
  const fromSnapshot = typeof snapshot?.userPrompt === 'string' ? snapshot.userPrompt.trim() : ''
  if (fromSnapshot) return fromSnapshot

  const text = prompt?.trim() ?? ''
  if (!text) return 'Untitled bed'

  const user = text.match(/User request:\s*([\s\S]+)/i)
  const extracted = user?.[1]?.trim()
  if (extracted) return extracted

  const first = text.split('\n').find((line) => {
    const trimmed = line.trim()
    return (
      trimmed.length > 0 && !/^(Mood|Tempo|Energy|Genres|Notes|Avoid|Instrumental)\b/i.test(trimmed)
    )
  })
  return first?.trim() || 'Untitled bed'
}

export const musicBedLicenseLabel = (row: {
  licenseStatus: string
  commercialUseAllowed: boolean
}): string => {
  if (row.licenseStatus === 'mock') return 'Mock — not Final'
  if (row.licenseStatus === 'cleared' && row.commercialUseAllowed) return 'Cleared for Final'
  return 'Not Final-eligible'
}

export const interpretMusicJobRecovery = (input: {
  status: string | undefined
  bedsAlreadyListed: boolean
}): MusicJobRecovery => {
  if (input.status === 'ready') {
    return {
      kind: 'ready',
      banner: 'Music bed ready — play it under Recent beds.',
      bannerTone: 'ok',
      clearPending: true,
      reload: true,
    }
  }
  if (input.status === 'failed') {
    return {
      kind: 'failed',
      banner: 'Music job failed. Retry Generate bed.',
      bannerTone: 'warn',
      clearPending: true,
      reload: true,
    }
  }
  if (input.status === 'queued' || input.status === 'generating') {
    return {
      kind: 'in_progress',
      banner: 'Generating music bed…',
      bannerTone: null,
      clearPending: false,
      reload: false,
    }
  }
  if (input.bedsAlreadyListed) {
    return {
      kind: 'silent',
      banner: null,
      bannerTone: null,
      clearPending: true,
      reload: false,
    }
  }
  return {
    kind: 'unverified',
    banner:
      'Could not verify the prior music job — regenerate if the bed is missing from Recent beds.',
    bannerTone: 'warn',
    clearPending: true,
    reload: false,
  }
}
