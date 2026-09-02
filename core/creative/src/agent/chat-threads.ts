/** #576 / ADR-0056 — chat threads on a Studio project (not the cut). */

import type { ChatMessage } from './types'

export const LEGACY_THREAD_ID = '00000000-0000-4000-8000-000000000001'
export const THREAD_TITLE_MAX = 48
export const THREAD_TITLE_MAX_WORDS = 6

export type ThreadTitleKind = 'time' | 'agent' | 'user'

export const timestampThreadTitle = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export type ChatThread = {
  id: string
  title: string
  createdAt: string
  messages: ChatMessage[]
  /** Who last set the title. Missing on pre-#853 threads. */
  titleKind?: ThreadTitleKind
}

export type ChatThreadBag = {
  activeId: string
  threads: ChatThread[]
}

export const titleFromMessages = (messages: ChatMessage[], fallback: string): string => {
  const firstUser = messages.find((message) => message.role === 'user' && message.content.trim())
  if (!firstUser) return fallback
  const oneLine = firstUser.content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= THREAD_TITLE_MAX) return oneLine
  return `${oneLine.slice(0, THREAD_TITLE_MAX - 1)}…`
}

export const clampThreadTitle = (raw: string, maxWords = THREAD_TITLE_MAX_WORDS): string => {
  const words = raw
    .replace(/["'`]/g, '')
    .replace(/[.|!?;:,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  const clipped = (words.length > 0 ? words : ['Chat']).slice(0, maxWords).join(' ')
  if (clipped.length <= THREAD_TITLE_MAX) return clipped
  return `${clipped.slice(0, THREAD_TITLE_MAX - 1)}…`
}

export const shouldAutoNameThread = (thread: ChatThread): boolean => {
  if (thread.titleKind === 'user' || thread.titleKind === 'agent') return false
  const hasUser = thread.messages.some(
    (message) => message.role === 'user' && message.content.trim(),
  )
  const hasAssistant = thread.messages.some(
    (message) => message.role === 'assistant' && message.content.trim(),
  )
  if (!hasUser || !hasAssistant) return false
  return thread.titleKind === 'time' || thread.titleKind === undefined
}

export const setThreadTitle = (
  bag: ChatThreadBag,
  threadId: string,
  title: string,
  kind: Exclude<ThreadTitleKind, 'time'>,
): ChatThreadBag => {
  const clamped = clampThreadTitle(title)
  return {
    ...bag,
    threads: bag.threads.map((thread) => {
      if (thread.id !== threadId) return thread
      if (kind === 'agent' && thread.titleKind === 'user') return thread
      return { ...thread, title: clamped, titleKind: kind }
    }),
  }
}

export const hydrateChatThreads = (input: {
  stored: ChatThreadBag | null | undefined
  legacyMessages: ChatMessage[]
  nowIso: string
  newId: string
}): ChatThreadBag => {
  const stored = input.stored
  if (stored && stored.threads.length > 0) {
    const activeId = stored.threads.some((thread) => thread.id === stored.activeId)
      ? stored.activeId
      : stored.threads[0]!.id
    return { activeId, threads: stored.threads }
  }
  const thread: ChatThread = {
    id: input.newId,
    title: titleFromMessages(input.legacyMessages, 'Chat'),
    createdAt: input.nowIso,
    messages: input.legacyMessages,
  }
  return { activeId: thread.id, threads: [thread] }
}

export const startNewChat = (
  bag: ChatThreadBag,
  input: { id: string; nowIso: string },
): ChatThreadBag => {
  const thread: ChatThread = {
    id: input.id,
    title: timestampThreadTitle(input.nowIso),
    createdAt: input.nowIso,
    messages: [],
    titleKind: 'time',
  }
  return { activeId: thread.id, threads: [thread, ...bag.threads] }
}

export const switchChatThread = (bag: ChatThreadBag, threadId: string): ChatThreadBag => {
  if (!bag.threads.some((thread) => thread.id === threadId)) {
    throw new Error(`Unknown chat thread ${threadId}`)
  }
  return { ...bag, activeId: threadId }
}

export const activeThreadMessages = (bag: ChatThreadBag): ChatMessage[] =>
  bag.threads.find((thread) => thread.id === bag.activeId)?.messages ?? []

export const writeActiveThreadMessages = (
  bag: ChatThreadBag,
  messages: ChatMessage[],
): ChatThreadBag => ({
  ...bag,
  threads: bag.threads.map((thread) =>
    thread.id === bag.activeId
      ? {
          ...thread,
          messages,
        }
      : thread,
  ),
})

export const threadSummaries = (
  bag: ChatThreadBag,
): Array<{ id: string; title: string; createdAt: string; active: boolean }> =>
  bag.threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    active: thread.id === bag.activeId,
  }))
