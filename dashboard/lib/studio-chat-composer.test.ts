import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMPOSER_MAX_HEIGHT_PX,
  COMPOSER_MIN_HEIGHT_PX,
  composerAutoHeightPx,
  shouldClearComposerDraft,
  syncComposerTextareaHeight,
} from './studio-chat-composer'

describe('shouldClearComposerDraft (#1257)', () => {
  it('keeps the draft when spend confirm intercepts send (cancel stays on that path)', () => {
    expect(shouldClearComposerDraft({ sendAccepted: false, turnPending: false })).toBe(false)
  })

  it('clears once the turn actually starts', () => {
    expect(shouldClearComposerDraft({ sendAccepted: false, turnPending: true })).toBe(true)
  })

  it('clears on an accepted send that did not need the modal', () => {
    expect(shouldClearComposerDraft({ sendAccepted: true, turnPending: false })).toBe(true)
  })
})

describe('Studio chat composer auto-height (#1307)', () => {
  it('grows with content then caps so a long brief scrolls inside the field', () => {
    expect(composerAutoHeightPx(12)).toBe(COMPOSER_MIN_HEIGHT_PX)
    expect(composerAutoHeightPx(120)).toBe(120)
    expect(composerAutoHeightPx(400)).toBe(COMPOSER_MAX_HEIGHT_PX)
  })

  it('resets then assigns the clamped height (shrinks after delete/send)', () => {
    const el = { style: { height: '120px' }, scrollHeight: 44 }
    syncComposerTextareaHeight(el)
    expect(el.style.height).toBe(`${COMPOSER_MIN_HEIGHT_PX}px`)
  })

  it('drops the manual resize grip and lets the field grow in CSS', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
    expect(css).toMatch(
      /\/\* #1307[\s\S]{0,80}?\.studio-chat-form textarea \{[\s\S]{0,220}?resize: none[\s\S]{0,160}?max-height: min\(40vh, 17\.5rem\)/,
    )
    expect(css).not.toMatch(
      /\/\* #1307[\s\S]{0,80}?\.studio-chat-form textarea \{[\s\S]{0,80}?resize: vertical/,
    )
  })
})
