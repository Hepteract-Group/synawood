import { describe, expect, it } from 'vitest'
import { failedTurnChatMessages } from './chat-store'
import type { ChatMessage } from './types'

describe('failedTurnChatMessages', () => {
  it('keeps the user bubble and an assistant error after a failed turn', () => {
    const prior: ChatMessage[] = [
      {
        id: 'm0',
        role: 'assistant',
        content: 'Ready.',
        createdAt: '2026-08-19T00:00:00.000Z',
      },
    ]
    const user: ChatMessage = {
      id: 'm1',
      role: 'user',
      content: 'produce a 25s ad for okiki alaso',
      createdAt: '2026-08-19T00:00:01.000Z',
    }
    const next = failedTurnChatMessages({
      prior,
      userMessage: user,
      error: 'Invalid JSON payload received. Unknown name "items"',
    })
    expect(next.map((message) => message.role)).toEqual(['assistant', 'user', 'assistant'])
    expect(next[1]).toEqual(user)
    expect(next[2]?.content).toContain('Unknown name "items"')
  })
})
