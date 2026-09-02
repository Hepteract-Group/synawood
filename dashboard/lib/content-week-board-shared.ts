export type BoardSlotStatus =
  'draft' | 'in_studio' | 'needs_review' | 'final_ready' | 'posted' | 'discarded'

/** Founder-facing product board columns (DnD source of truth). */
export type PmColumn = 'planned' | 'in_progress' | 'done'

export type SlotPriority = 'p0' | 'p1' | 'p2'

export type PostedLink = {
  id: string
  channel: string
  url: string
  status: string
}

export type SlotPublishRecord = {
  id: string
  channel: string
  status: string
  scheduledAt: string | null
  externalUrl: string | null
}

export type SlotComment = {
  id: string
  author: string
  body: string
  createdAt: string
}

export type WeekBoardSlot = {
  slotId: string
  weekId: string
  channel: string
  title: string
  description: string | null
  draftPath: string | null
  projectId: string | null
  projectStatus: string | null
  boardStatus: BoardSlotStatus
  pmColumn: PmColumn
  priority: SlotPriority | null
  dueDate: string | null
  plannedDate: string | null
  /** ISO weekday 1=Mon … 7=Sun derived from plannedDate when present. */
  plannedWeekday: number | null
  labels: string[]
  assignee: string | null
  hasFinal: boolean
  finalAssetId: string | null
  /** Approve under watermarking plan — Work board "Trial export" (#1046). */
  trialExport: boolean
  thumbnailAssetId: string | null
  postedLinks: PostedLink[]
  publishes: SlotPublishRecord[]
  studioHref: string | null
  commentCount: number
}

export type WeekBoard = {
  productId: string
  weekId: string
  weekStartIso: string
  slots: WeekBoardSlot[]
}

export type MonthBoard = {
  productId: string
  month: string
  slots: WeekBoardSlot[]
}

/** All product tasks for the kanban (not scoped to a calendar week). */
export type ProductBoard = {
  productId: string
  slots: WeekBoardSlot[]
}

export const slotShowsThumbnailPicker = (
  slot: Pick<WeekBoardSlot, 'projectId' | 'hasFinal'>,
): boolean => Boolean(slot.projectId && slot.hasFinal)

const BLOCKING_PUBLISH_STATUS = new Set(['scheduled', 'posted', 'manual_posted'])

export const slotCanSchedule = (slot: Pick<WeekBoardSlot, 'hasFinal' | 'publishes'>): boolean => {
  if (!slot.hasFinal) return false
  return !(slot.publishes ?? []).some((row) => BLOCKING_PUBLISH_STATUS.has(row.status))
}

export const slotScheduledPublishes = (
  slots: Array<Pick<WeekBoardSlot, 'publishes'>>,
): SlotPublishRecord[] =>
  slots.flatMap((slot) => (slot.publishes ?? []).filter((row) => row.status === 'scheduled'))

export const inferChannelFromDraftName = (fileName: string): string => {
  const lower = fileName.toLowerCase()
  if (lower.includes('linkedin')) return 'linkedin_founder'
  if (lower.includes('-x-') || lower.startsWith('x-') || lower.includes('twitter')) {
    return 'x_founder'
  }
  if (lower.includes('tiktok')) return 'tiktok_organic'
  if (lower.includes('blog')) return 'blog_seo'
  return 'linkedin_founder'
}

export const titleFromDraft = (fileName: string, markdown: string): string => {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
  if (heading) return heading
  return fileName.replace(/\.md$/i, '').replace(/^\d+-/, '').replace(/-/g, ' ')
}

export const deriveBoardStatus = (input: {
  projectStatus: string | null
  hasFinal: boolean
  publishStatus: string | null
}): BoardSlotStatus => {
  if (input.publishStatus === 'manual_posted' || input.publishStatus === 'posted') {
    return 'posted'
  }
  if (input.projectStatus === 'killed') return 'discarded'
  if (input.hasFinal || input.projectStatus === 'approved') return 'final_ready'
  if (input.projectStatus === 'needs_review' || input.projectStatus === 'rendering') {
    return 'needs_review'
  }
  if (input.projectStatus === 'drafting') return 'in_studio'
  return 'draft'
}

export const toPmColumn = (status: BoardSlotStatus): PmColumn => {
  if (status === 'posted' || status === 'discarded') return 'done'
  if (status === 'draft') return 'planned'
  return 'in_progress'
}

/**
 * Display column for the kanban.
 * Pipeline Done always wins. Dragging to Done without a posted URL does not stick.
 * In-progress pipeline lifts a stored Planned column.
 */
export const resolvePmColumn = (
  boardStatus: BoardSlotStatus,
  stored: PmColumn | null | undefined,
): PmColumn => {
  const derived = toPmColumn(boardStatus)
  if (derived === 'done') return 'done'
  if (!stored || stored === 'done') return derived
  if (derived === 'in_progress' && stored === 'planned') return 'in_progress'
  return stored
}

export const boardStatusLabel = (status: BoardSlotStatus): string => {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'in_studio':
      return 'In Studio'
    case 'needs_review':
      return 'Needs review'
    case 'final_ready':
      return 'Final ready'
    case 'posted':
      return 'Posted'
    case 'discarded':
      return 'Discarded'
  }
}

export const pmColumnLabel = (column: PmColumn): string => {
  switch (column) {
    case 'planned':
      return 'Planned'
    case 'in_progress':
      return 'In progress'
    case 'done':
      return 'Done'
  }
}

export const priorityLabel = (priority: SlotPriority | null): string => {
  if (!priority) return 'None'
  if (priority === 'p0') return 'P0'
  if (priority === 'p1') return 'P1'
  return 'P2'
}

const WEEKDAY_TOKEN: Record<string, number> = {
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7,
}

export const parseWeekdayHint = (raw: string): number | null => {
  const tokens = raw.toLowerCase().match(/[a-z]+/g) ?? []
  for (const token of tokens) {
    const day = WEEKDAY_TOKEN[token]
    if (day) return day
  }
  return null
}

export const parseWeekPlanDays = (readme: string): Map<string, number> => {
  const map = new Map<string, number>()
  for (const line of readme.split('\n')) {
    if (!line.includes('|') || !line.includes('`')) continue
    const file = line.match(/`([^`]+\.md)`/)?.[1]
    if (!file) continue
    const cells = line.split('|').map((cell) => cell.trim())
    const dayCell = cells[cells.length - 2] ?? cells[cells.length - 1] ?? ''
    const weekday = parseWeekdayHint(dayCell)
    if (weekday) map.set(file, weekday)
  }
  return map
}

export const mondayOfIsoWeek = (weekId: string): Date => {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return new Date(NaN)
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1)
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return monday
}

export const isoDateUtc = (date: Date): string => date.toISOString().slice(0, 10)

export const isoWeekIdFromDate = (date: Date): string => {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export const isIsoWeekId = (value: string): boolean => /^\d{4}-W\d{2}$/.test(value)

export const shiftIsoWeek = (weekId: string, delta: number): string => {
  const monday = mondayOfIsoWeek(weekId)
  monday.setUTCDate(monday.getUTCDate() + delta * 7)
  return isoWeekIdFromDate(monday)
}

/** Founder-facing week label — date range, not folder ids like 2026-W29. */
export const weekRangeLabel = (weekId: string): string => {
  const monday = mondayOfIsoWeek(weekId)
  if (Number.isNaN(monday.getTime())) return weekId
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth()
  const start = monday.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const end = sunday.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${start} – ${end}`
}

export const plannedDateForWeekday = (weekId: string, weekday: number): string => {
  const monday = mondayOfIsoWeek(weekId)
  const day = new Date(monday)
  day.setUTCDate(monday.getUTCDate() + (weekday - 1))
  return isoDateUtc(day)
}

export const weekdayFromIsoDate = (isoDate: string): number => {
  const day = new Date(`${isoDate}T12:00:00.000Z`).getUTCDay() || 7
  return day
}

export const parseLabels = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export const weekOverlapsMonth = (weekId: string, month: string): boolean => {
  const [year, monthNum] = month.split('-').map(Number)
  if (!year || !monthNum) return false
  const start = `${month}-01`
  const end = isoDateUtc(new Date(Date.UTC(year, monthNum, 0)))
  const monday = mondayOfIsoWeek(weekId)
  if (Number.isNaN(monday.getTime())) return false
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return !(isoDateUtc(sunday) < start || isoDateUtc(monday) > end)
}
