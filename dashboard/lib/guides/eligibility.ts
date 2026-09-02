import type { GuideDefinition } from './catalogue'

export type GuideProgressRow = {
  guideId: string
  status: string
}

const TERMINAL = new Set(['completed', 'dismissed'])

const asTime = (value: Date | string | null | undefined): number | null => {
  if (!value) return null
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export const readGuideForceId = (env: {
  GUIDE_FORCE_ID?: string
  VERCEL_ENV?: string
}): string | undefined => {
  if (env.VERCEL_ENV === 'production') return undefined
  const id = env.GUIDE_FORCE_ID?.trim()
  return id || undefined
}

export const selectEligibleGuides = (input: {
  now: Date
  previousLoginAt: Date | string | null
  userCreatedAt: Date | string
  memberships: { role: string }[]
  progress: GuideProgressRow[]
  catalogue: GuideDefinition[]
  forceId?: string
}): GuideDefinition[] => {
  const progressById = new Map(input.progress.map((row) => [row.guideId, row.status]))

  if (input.forceId) {
    const forced = input.catalogue.find((guide) => guide.id === input.forceId)
    if (!forced) return []
    const status = progressById.get(forced.id)
    if (status && TERMINAL.has(status)) return []
    return [forced]
  }

  const now = input.now.getTime()
  const previousLogin = asTime(input.previousLoginAt)
  const createdAt = asTime(input.userCreatedAt) ?? 0
  const hasMembership = input.memberships.length > 0
  const isOwner = input.memberships.some((row) => row.role === 'owner')
  const isEditor = input.memberships.some((row) => row.role === 'owner' || row.role === 'editor')

  const open = input.catalogue.filter((guide) => {
    const released = Date.parse(guide.releasedAt)
    if (!Number.isFinite(released) || released > now) return false
    const status = progressById.get(guide.id)
    if (status && TERMINAL.has(status)) return false
    if (guide.audience === 'owner' && !isOwner) return false
    if (guide.audience === 'editor' && !isEditor) return false
    if (guide.supersedesId) {
      const priorStatus = progressById.get(guide.supersedesId)
      if (priorStatus && TERMINAL.has(priorStatus)) return false
    }
    if (guide.kind === 'welcome') return hasMembership
    if (!hasMembership) return false
    if (createdAt >= released && !guide.includeNewUsers) return false
    if (previousLogin !== null && previousLogin >= released) return false
    return true
  })

  const welcomes = open
    .filter((guide) => guide.kind === 'welcome')
    .sort((a, b) => Date.parse(b.releasedAt) - Date.parse(a.releasedAt))
  const welcome = welcomes[0] ? [welcomes[0]] : []
  const features = open
    .filter((guide) => guide.kind === 'feature')
    .sort((a, b) => Date.parse(a.releasedAt) - Date.parse(b.releasedAt))
  // One auto-prompt per login (ADR-0069): welcome beats features; else oldest feature.
  if (welcome[0]) return welcome
  return features[0] ? [features[0]] : []
}
