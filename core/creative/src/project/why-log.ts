import { studioProjectSchema, type StudioProject, type WhyLogEntry } from './schema'

export const WHY_LOG_CAP = 100

export type WhyLogDraft = {
  t: number
  target: string
  action: string
  reason: string
}

export const formatWhyLogTimecode = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export const secondsAtFrame = (project: StudioProject, frame: number): number => {
  const fps = project.fps > 0 ? project.fps : 30
  return Math.max(0, frame) / fps
}

/** Append an operator-facing why row. Does not bump revision. Caps at last 100. */
export const appendWhyLog = (project: StudioProject, draft: WhyLogDraft): StudioProject => {
  const entry: WhyLogEntry = {
    id: crypto.randomUUID(),
    t: Number.isFinite(draft.t) ? Math.max(0, draft.t) : 0,
    target: draft.target.trim() || 'cut',
    action: draft.action.trim() || 'edit',
    reason: draft.reason.trim() || 'Timeline changed.',
  }
  return studioProjectSchema.parse({
    ...project,
    whyLog: [...(project.whyLog ?? []), entry].slice(-WHY_LOG_CAP),
  })
}
