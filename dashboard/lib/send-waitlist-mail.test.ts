import { describe, expect, it, vi } from 'vitest'
import { sendWaitlistConfirmation, waitlistConfirmationText } from './send-waitlist-mail'

describe('sendWaitlistConfirmation (#340)', () => {
  it('skips when RESEND_API_KEY is unset', async () => {
    const result = await sendWaitlistConfirmation({
      email: 'a@example.com',
      env: {},
    })
    expect(result).toEqual({
      sent: false,
      skipped: true,
      reason: 'RESEND_API_KEY unset; confirmation skipped. Waitlist row is saved.',
    })
  })

  it('posts to Resend when a key is set', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: 200 }),
    ) as unknown as typeof fetch
    const result = await sendWaitlistConfirmation({
      email: 'a@example.com',
      env: { RESEND_API_KEY: 're_test', WAITLIST_MAIL_FROM: 'Test <t@example.com>' },
      fetchImpl,
    })
    expect(result).toEqual({ sent: true })
    expect(fetchImpl).toHaveBeenCalled()
    expect(waitlistConfirmationText('a@example.com')).toMatch(/not a magic link/)
    expect(waitlistConfirmationText('a@example.com')).toMatch(/Synawood/)
    expect(waitlistConfirmationText('a@example.com')).not.toMatch(/Synawood/)
  })

  it('does not throw when Resend fails so the waitlist row can stay', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const result = await sendWaitlistConfirmation({
      email: 'a@example.com',
      env: { RESEND_API_KEY: 're_test' },
      fetchImpl,
    })
    expect(result.sent).toBe(false)
    expect('skipped' in result && result.skipped).toBe(false)
  })
})
