import { describe, expect, it } from 'vitest'
import { closeAudioContextOnce } from './closeAudioContextOnce'

describe('closeAudioContextOnce (#1338)', () => {
  it('does not throw when close runs twice (effect cleanup + decode finally)', () => {
    let closes = 0
    const ctx = {
      state: 'running',
      close: () => {
        closes += 1
        if (closes > 1) {
          throw new DOMException('Cannot close a closed AudioContext.', 'InvalidStateError')
        }
        ctx.state = 'closed'
      },
    }
    const closeOnce = closeAudioContextOnce(ctx)
    expect(() => {
      closeOnce()
      closeOnce()
    }).not.toThrow()
    expect(closes).toBe(1)
    expect(ctx.state).toBe('closed')
  })
})
