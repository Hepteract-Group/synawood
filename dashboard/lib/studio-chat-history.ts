export type ChatHistoryThread = {
  id: string
  title: string
  createdAt: string
  active: boolean
}

export type ChatHistoryGroupId = 'today' | 'yesterday' | 'week' | 'older'

export type ChatHistoryGroup = {
  id: ChatHistoryGroupId
  label: string
  threads: ChatHistoryThread[]
}

const startOfLocalDay = (ms: number): number => {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const addLocalDays = (startMs: number, days: number): number => {
  const date = new Date(startMs)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export const groupChatHistory = (
  threads: ChatHistoryThread[],
  query: string,
  nowMs: number,
): ChatHistoryGroup[] => {
  const needle = query.trim().toLowerCase()
  const matched = threads.filter(
    (thread) => needle === '' || thread.title.toLowerCase().includes(needle),
  )
  const sorted = [...matched].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
  const today = startOfLocalDay(nowMs)
  const yesterday = addLocalDays(today, -1)
  const week = addLocalDays(today, -7)
  const buckets: Record<ChatHistoryGroupId, ChatHistoryThread[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  }
  for (const thread of sorted) {
    const created = new Date(thread.createdAt).getTime()
    const day = Number.isFinite(created) ? startOfLocalDay(created) : 0
    if (day >= today) buckets.today.push(thread)
    else if (day >= yesterday) buckets.yesterday.push(thread)
    else if (day >= week) buckets.week.push(thread)
    else buckets.older.push(thread)
  }
  const labels: { id: ChatHistoryGroupId; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'Previous 7 days' },
    { id: 'older', label: 'Older' },
  ]
  return labels
    .map((group) => ({ ...group, threads: buckets[group.id] }))
    .filter((group) => group.threads.length > 0)
}
