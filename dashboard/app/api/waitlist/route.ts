import { NextResponse } from 'next/server'
import { createServiceSupabase, readSupabaseEnv } from '@synawood/creative'
import { jsonError } from '../../../lib/studio-server'
import { sendWaitlistConfirmation } from '../../../lib/send-waitlist-mail'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 320) return null
  return email
}

/** Public waitlist join — no Auth user. Persist first, then optional confirmation mail. */
export const POST = async (request: Request) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Send a JSON body with an email.', 400)
  }

  const email = normalizeEmail(
    body && typeof body === 'object' && 'email' in body ? (body as { email: unknown }).email : null,
  )
  if (!email) {
    return jsonError('Enter a valid email address.', 400)
  }

  try {
    const supabaseEnv = readSupabaseEnv(process.env)
    const supabase = createServiceSupabase(supabaseEnv)
    const { error } = await supabase
      .from('waitlist_entries')
      .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) {
      return jsonError(`Could not save your email: ${error.message}`, 500)
    }

    const existing = await supabase
      .from('waitlist_entries')
      .select('email_sent_at')
      .eq('email', email)
      .maybeSingle()
    const alreadySent = Boolean(existing.data?.email_sent_at)
    const mail = alreadySent
      ? { sent: false as const, skipped: true as const, reason: 'Confirmation already sent.' }
      : await sendWaitlistConfirmation({ email })
    if (mail.sent) {
      await supabase
        .from('waitlist_entries')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('email', email)
    }

    return NextResponse.json({
      ok: true,
      emailSent: mail.sent,
      emailSkipped: 'skipped' in mail ? mail.skipped : false,
    })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Waitlist is temporarily unavailable.',
      503,
    )
  }
}
