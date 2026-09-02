import { describe, expect, it, vi } from 'vitest'
import { LANDING_HREF, signOutToLanding } from './sign-out-to-landing'

describe('signOutToLanding (#1138)', () => {
  it('ends the session then opens the marketing landing', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const assign = vi.fn()

    await signOutToLanding({ signOut, assign })

    expect(signOut).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith(LANDING_HREF)
    expect(LANDING_HREF).toBe('/')
  })

  it('does not open the landing if sign-out throws', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('network'))
    const assign = vi.fn()

    await expect(signOutToLanding({ signOut, assign })).rejects.toThrow('network')
    expect(assign).not.toHaveBeenCalled()
  })

  it('does not open the landing if GoTrue returns an error object', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: { message: 'session missing' } })
    const assign = vi.fn()

    await expect(signOutToLanding({ signOut, assign })).rejects.toThrow('session missing')
    expect(assign).not.toHaveBeenCalled()
  })
})
