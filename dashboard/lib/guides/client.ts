import { GUIDE_CATALOGUE } from './catalogue'
import { readApiJson } from '../read-api-json'

export type GuideApiItem = {
  id: string
  title: string
  summary: string
  kind: string
  stepCount: number
  status: string
  stepIndex: number
}

export type GuideSessionPayload = {
  previousLoginAt: string | null
  onboardingCompleted: boolean
  eligibleGuides: Array<{
    id: string
    kind: string
    title: string
    summary: string
    steps: (typeof GUIDE_CATALOGUE)[number]['steps']
    status: string
    stepIndex: number
  }>
}

const throwIfFailed = (ok: boolean, message: string | undefined, fallback: string): void => {
  if (!ok) throw new Error(message ?? fallback)
}

export const postGuideSession = async (): Promise<GuideSessionPayload> => {
  const response = await fetch('/api/me/session', { method: 'POST' })
  const body = await readApiJson<GuideSessionPayload & { error?: string }>(response)
  throwIfFailed(response.ok, body.error, 'Could not start your session.')
  return body
}

export const fetchGuideList = async (): Promise<GuideApiItem[]> => {
  const response = await fetch('/api/me/guides')
  const body = await readApiJson<{ guides?: GuideApiItem[]; error?: string }>(response)
  throwIfFailed(response.ok, body.error, 'Could not load guides.')
  return body.guides ?? []
}

export const putGuideProgress = async (
  guideId: string,
  status: string,
  stepIndex: number,
): Promise<void> => {
  const response = await fetch(`/api/me/guides/${guideId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, stepIndex }),
  })
  const body = await readApiJson<{ error?: string }>(response)
  throwIfFailed(response.ok, body.error, 'Could not save the guide. Try again.')
}

export const firstGuideRoute = (guideId: string): string | undefined =>
  GUIDE_CATALOGUE.find((guide) => guide.id === guideId)?.steps[0]?.route
