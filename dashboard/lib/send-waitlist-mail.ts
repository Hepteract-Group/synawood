/** Waitlist confirmation mail (#340). Failures must not erase the waitlist row. */

import { PRODUCT_NAME } from './product-name'

export type WaitlistMailResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string }

const FROM_DEFAULT = `${PRODUCT_NAME} <hello@localhost>`

export const waitlistConfirmationHtml = (email: string): string =>
  `<p>You are on the ${PRODUCT_NAME} waitlist (${email}).</p>
<p>This is not dashboard access and not a magic link. We will email when a seat opens.</p>`

export const waitlistConfirmationText = (email: string): string =>
  `You are on the ${PRODUCT_NAME} waitlist (${email}). This is not dashboard access and not a magic link. We will email when a seat opens.`

export const sendWaitlistConfirmation = async (input: {
  email: string
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}): Promise<WaitlistMailResult> => {
  const env = input.env ?? process.env
  const apiKey = env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return {
      sent: false,
      skipped: true,
      reason: 'RESEND_API_KEY unset; confirmation skipped. Waitlist row is saved.',
    }
  }
  const from = env.WAITLIST_MAIL_FROM?.trim() || FROM_DEFAULT
  try {
    const fetchImpl = input.fetchImpl ?? fetch
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: `You are on the ${PRODUCT_NAME} waitlist`,
        text: waitlistConfirmationText(input.email),
        html: waitlistConfirmationHtml(input.email),
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return {
        sent: false,
        skipped: false,
        reason: `Mail provider ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`,
      }
    }
    return { sent: true }
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'Mail send failed',
    }
  }
}
