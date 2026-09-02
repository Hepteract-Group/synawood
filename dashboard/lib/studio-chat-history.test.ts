import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { groupChatHistory, type ChatHistoryThread } from './studio-chat-history'

const at = (year: number, month: number, day: number): string =>
  new Date(year, month, day, 15, 0, 0).toISOString()

const thread = (
  id: string,
  title: string,
  createdAt: string,
  active = false,
): ChatHistoryThread => ({ id, title, createdAt, active })

describe('groupChatHistory (#1309)', () => {
  const now = new Date(2026, 7, 29, 13, 50, 0).getTime()
  const threads = [
    thread('t-today', 'Povotra Kinetic Type A', at(2026, 7, 29), true),
    thread('t-yest', '28 Aug, 08:08', at(2026, 7, 28)),
    thread('t-week', 'Motion graphics ads', at(2026, 7, 24)),
    thread('t-old', 'First cut notes', at(2026, 6, 2)),
  ]

  it('groups by Today, Yesterday, Previous 7 days, and Older', () => {
    const groups = groupChatHistory(threads, '', now)
    expect(groups.map((group) => group.label)).toEqual([
      'Today',
      'Yesterday',
      'Previous 7 days',
      'Older',
    ])
    expect(groups.map((group) => group.threads.map((item) => item.id))).toEqual([
      ['t-today'],
      ['t-yest'],
      ['t-week'],
      ['t-old'],
    ])
  })

  it('filters titles without dropping the date groups that still have hits', () => {
    const groups = groupChatHistory(threads, 'kinetic', now)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Today')
    expect(groups[0]?.threads[0]?.id).toBe('t-today')
  })

  it('returns no groups when search matches nothing', () => {
    expect(groupChatHistory(threads, 'zzzz', now)).toEqual([])
  })
})

describe('previous-chats chrome (#1309)', () => {
  it('uses a popover, not a one-row slider', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
    expect(css).toMatch(/\.studio-chat-history-popover \{/)
    expect(css).not.toMatch(/\.studio-chat-history-track \{/)
    const adr = readFileSync(
      join(process.cwd(), '../docs/adr/0066-agent-named-studio-chat-threads.md'),
      'utf8',
    )
    expect(adr).toMatch(/popover/)
    expect(adr).not.toMatch(/one-row horizontal slider/)
  })
})

const cssZIndex = (css: string, selector: string): number => {
  const block = css.match(new RegExp(`${selector.replace(/[.[\\]]/g, '\\$&')} \\{([^}]+)\\}`))
  const value = block?.[1]?.match(/z-index:\s*(\d+)/)?.[1]
  if (!value) throw new Error(`missing z-index for ${selector}`)
  return Number(value)
}

describe('Intent overlay vs chat chrome (#1313)', () => {
  it('stacks the flyout above chat chrome and hides inert chat', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
    expect(cssZIndex(css, '.intent-rail-flyout')).toBeGreaterThan(
      cssZIndex(css, '.studio-chat-chrome'),
    )
    expect(css).toMatch(/\.studio-chat\[inert\] \{\s*visibility:\s*hidden/)
    const chat = readFileSync(join(process.cwd(), 'components/studio/Chat.tsx'), 'utf8')
    expect(chat).toMatch(/inert=\{railOverlayOpen \|\| undefined\}/)
  })
})
