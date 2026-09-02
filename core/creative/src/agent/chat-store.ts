import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ToolTraceEntry } from '../tools/types'
import type { ChatMessage } from './types'
import {
  activeThreadMessages,
  hydrateChatThreads,
  LEGACY_THREAD_ID,
  setThreadTitle,
  shouldAutoNameThread,
  startNewChat,
  switchChatThread,
  threadSummaries,
  writeActiveThreadMessages,
  type ChatThreadBag,
} from './chat-threads'

export const CHAT_MESSAGE_CAP = 80

const parseStoredBag = (raw: unknown): ChatThreadBag | null => {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as { activeId?: unknown; threads?: unknown }
  if (typeof rec.activeId !== 'string' || !Array.isArray(rec.threads) || rec.threads.length === 0) {
    return null
  }
  return rec as ChatThreadBag
}

export const loadChatThreadBag = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ bag: ChatThreadBag; toolTrace: ToolTraceEntry[] }> => {
  const { data, error } = await supabase
    .from('studio_projects')
    .select('chat_messages, chat_threads, tool_trace')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load chat state: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const legacyMessages = Array.isArray(data.chat_messages)
    ? (data.chat_messages as ChatMessage[])
    : []
  const stored = parseStoredBag(data.chat_threads)
  const bag = hydrateChatThreads({
    stored,
    legacyMessages,
    nowIso: new Date().toISOString(),
    newId: LEGACY_THREAD_ID,
  })
  return {
    bag,
    toolTrace: Array.isArray(data.tool_trace) ? (data.tool_trace as ToolTraceEntry[]) : [],
  }
}

export const persistChatThreadBag = async (
  supabase: SupabaseClient,
  projectId: string,
  bag: ChatThreadBag,
): Promise<void> => {
  const active = activeThreadMessages(bag)
  const { error } = await supabase
    .from('studio_projects')
    .update({
      chat_messages: active.slice(-CHAT_MESSAGE_CAP),
      chat_threads: bag,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  if (error) {
    throw new Error(`Failed to save chat state: ${error.message}`)
  }
}

export const loadChatState = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<{
  messages: ChatMessage[]
  toolTrace: ToolTraceEntry[]
  threads: ReturnType<typeof threadSummaries>
}> => {
  const { bag, toolTrace } = await loadChatThreadBag(supabase, projectId)
  return {
    messages: activeThreadMessages(bag),
    toolTrace,
    threads: threadSummaries(bag),
  }
}

/** Keep the founder prompt (and a visible error) when generateText 400s before save. */
export const failedTurnChatMessages = (input: {
  prior: ChatMessage[]
  userMessage: ChatMessage
  error: string
}): ChatMessage[] => [
  ...input.prior,
  input.userMessage,
  {
    id: crypto.randomUUID(),
    role: 'assistant' as const,
    content: input.error,
    createdAt: new Date().toISOString(),
  },
]

export const saveChatMessages = async (
  supabase: SupabaseClient,
  projectId: string,
  messages: ChatMessage[],
): Promise<void> => {
  const { bag } = await loadChatThreadBag(supabase, projectId)
  await persistChatThreadBag(supabase, projectId, writeActiveThreadMessages(bag, messages))
}

export const createChatThread = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<ChatThreadBag> => {
  const { bag } = await loadChatThreadBag(supabase, projectId)
  const next = startNewChat(bag, { id: randomUUID(), nowIso: new Date().toISOString() })
  await persistChatThreadBag(supabase, projectId, next)
  return next
}

export const selectChatThread = async (
  supabase: SupabaseClient,
  projectId: string,
  threadId: string,
): Promise<ChatThreadBag> => {
  const { bag } = await loadChatThreadBag(supabase, projectId)
  const next = switchChatThread(bag, threadId)
  await persistChatThreadBag(supabase, projectId, next)
  return next
}

export const renameChatThread = async (
  supabase: SupabaseClient,
  projectId: string,
  threadId: string,
  title: string,
): Promise<ChatThreadBag> => {
  const { bag } = await loadChatThreadBag(supabase, projectId)
  const next = setThreadTitle(bag, threadId, title, 'user')
  await persistChatThreadBag(supabase, projectId, next)
  return next
}

export const maybeNameActiveThread = async (
  supabase: SupabaseClient,
  projectId: string,
  nameTitle: (input: { userText: string; assistantText: string }) => Promise<string>,
): Promise<ChatThreadBag> => {
  const { bag } = await loadChatThreadBag(supabase, projectId)
  const active = bag.threads.find((thread) => thread.id === bag.activeId)
  if (!active || !shouldAutoNameThread(active)) return bag
  const userText = active.messages.find((message) => message.role === 'user')?.content ?? ''
  const assistantText =
    [...active.messages].reverse().find((message) => message.role === 'assistant')?.content ?? ''
  const title = await nameTitle({ userText, assistantText })
  const next = setThreadTitle(bag, bag.activeId, title, 'agent')
  await persistChatThreadBag(supabase, projectId, next)
  return next
}

export const appendToolTraceEntries = async (
  supabase: SupabaseClient,
  projectId: string,
  entries: ToolTraceEntry[],
): Promise<void> => {
  if (entries.length === 0) return
  const { error } = await supabase.rpc('append_studio_tool_trace', {
    p_project_id: projectId,
    p_entries: entries,
  })
  if (error) {
    throw new Error(`Failed to append tool trace: ${error.message}`)
  }
}
