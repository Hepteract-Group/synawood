import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ChatMessage } from './types'
import {
  activeThreadMessages,
  clampThreadTitle,
  hydrateChatThreads,
  setThreadTitle,
  shouldAutoNameThread,
  startNewChat,
  switchChatThread,
  titleFromMessages,
  writeActiveThreadMessages,
} from './chat-threads'

const msg = (role: ChatMessage['role'], content: string, id: string): ChatMessage => ({
  id,
  role,
  content,
  createdAt: '2026-08-20T12:00:00.000Z',
})

describe('chat threads (#576)', () => {
  it('titles a thread from the first user line', () => {
    expect(
      titleFromMessages(
        [msg('assistant', 'Ready.', 'a'), msg('user', 'cover proof with close-ups', 'u')],
        'Chat',
      ),
    ).toBe('cover proof with close-ups')
  })

  it('wraps legacy chat_messages as the first thread', () => {
    const legacy = [msg('user', 'add captions', 'u1')]
    const bag = hydrateChatThreads({
      stored: null,
      legacyMessages: legacy,
      nowIso: '2026-08-20T12:00:00.000Z',
      newId: '11111111-1111-4111-8111-111111111111',
    })
    expect(bag.threads).toHaveLength(1)
    expect(bag.activeId).toBe('11111111-1111-4111-8111-111111111111')
    expect(activeThreadMessages(bag)).toEqual(legacy)
    expect(bag.threads[0]?.title).toBe('add captions')
  })

  it('starts a new empty thread without dropping the previous one', () => {
    const bag = hydrateChatThreads({
      stored: null,
      legacyMessages: [msg('user', 'old experiment', 'u1')],
      nowIso: '2026-08-20T12:00:00.000Z',
      newId: '11111111-1111-4111-8111-111111111111',
    })
    const next = startNewChat(bag, {
      id: '22222222-2222-4222-8222-222222222222',
      nowIso: '2026-08-20T13:00:00.000Z',
    })
    expect(activeThreadMessages(next)).toEqual([])
    expect(next.threads).toHaveLength(2)
    expect(next.threads[1]?.messages[0]?.content).toBe('old experiment')
  })

  it('switches threads and keeps both message lists', () => {
    const first = hydrateChatThreads({
      stored: null,
      legacyMessages: [msg('user', 'first', 'u1')],
      nowIso: '2026-08-20T12:00:00.000Z',
      newId: '11111111-1111-4111-8111-111111111111',
    })
    const withNew = startNewChat(first, {
      id: '22222222-2222-4222-8222-222222222222',
      nowIso: '2026-08-20T13:00:00.000Z',
    })
    const written = writeActiveThreadMessages(withNew, [msg('user', 'second', 'u2')])
    const back = switchChatThread(written, '11111111-1111-4111-8111-111111111111')
    expect(activeThreadMessages(back)[0]?.content).toBe('first')
    expect(
      written.threads.find((t) => t.id === '22222222-2222-4222-8222-222222222222')?.messages[0]
        ?.content,
    ).toBe('second')
  })

  it('clamps titles to six words (#853)', () => {
    expect(clampThreadTitle('Povotra interview prep ads with music and a tight hook')).toBe(
      'Povotra interview prep ads with music',
    )
    expect(clampThreadTitle('  "Logo sting"  ')).toBe('Logo sting')
  })

  it('does not retitle from the first user line once messages land (#853)', () => {
    const bag = startNewChat(
      hydrateChatThreads({
        stored: null,
        legacyMessages: [],
        nowIso: '2026-08-20T12:00:00.000Z',
        newId: '11111111-1111-4111-8111-111111111111',
      }),
      { id: '22222222-2222-4222-8222-222222222222', nowIso: '2026-08-20T13:00:00.000Z' },
    )
    const before = bag.threads[0]?.title
    const next = writeActiveThreadMessages(bag, [
      msg('user', 'please make a 30s interview prep ad for Povotra with music', 'u1'),
    ])
    expect(next.threads[0]?.title).toBe(before)
  })

  it('names after the first fulfilled turn and will not overwrite a founder rename (#853)', () => {
    let bag = startNewChat(
      hydrateChatThreads({
        stored: null,
        legacyMessages: [],
        nowIso: '2026-08-20T12:00:00.000Z',
        newId: '11111111-1111-4111-8111-111111111111',
      }),
      { id: '22222222-2222-4222-8222-222222222222', nowIso: '2026-08-20T13:00:00.000Z' },
    )
    expect(shouldAutoNameThread(bag.threads[0]!)).toBe(false)
    bag = writeActiveThreadMessages(bag, [
      msg('user', 'please make a 30s interview prep ad for Povotra with music', 'u1'),
      msg('assistant', 'I laid a 30s cut with music and brand.', 'a1'),
    ])
    expect(shouldAutoNameThread(bag.threads[0]!)).toBe(true)
    bag = setThreadTitle(bag, bag.activeId, 'Povotra interview prep ad', 'agent')
    expect(bag.threads[0]?.title).toBe('Povotra interview prep ad')
    expect(shouldAutoNameThread(bag.threads[0]!)).toBe(false)
    bag = setThreadTitle(bag, bag.activeId, 'My cut', 'user')
    bag = setThreadTitle(bag, bag.activeId, 'Agent wants this instead', 'agent')
    expect(bag.threads[0]?.title).toBe('My cut')
  })

  it('keeps more than 80 messages on a thread', () => {
    const bag = hydrateChatThreads({
      stored: null,
      legacyMessages: [],
      nowIso: '2026-08-20T12:00:00.000Z',
      newId: '11111111-1111-4111-8111-111111111111',
    })
    const many = Array.from({ length: 90 }, (_, i) => msg('user', `line ${i}`, `u${i}`))
    const next = writeActiveThreadMessages(bag, many)
    expect(activeThreadMessages(next)).toHaveLength(90)
  })

  it('migration adds chat_threads jsonb on studio_projects', () => {
    const sql = readFileSync(
      path.join(
        fileURLToPath(new URL('.', import.meta.url)),
        '../../../../supabase/migrations/0039_chat_threads.sql',
      ),
      'utf8',
    )
    expect(sql).toContain('add column if not exists chat_threads jsonb')
  })
})
