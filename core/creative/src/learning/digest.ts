/** Optional weekly insights digest (ADR-0036 / #259). */

export const draftDigest = (
  insights: Array<{ title: string; body: string }>,
  productId: string,
): { subject: string; text: string; html: string } => {
  const subject = `Insights review (${productId}): ${insights.length} open`
  const lines =
    insights.length === 0
      ? ['No open insights. Record outcomes, then run analyses.']
      : insights.map((row) => `- ${row.title}: ${row.body}`)
  const text = [`Weekly insights for ${productId}.`, ...lines].join('\n')
  const html = `<p>Weekly insights for ${productId}.</p><ul>${insights
    .map((row) => `<li><strong>${row.title}</strong> ${row.body}</li>`)
    .join('')}</ul>`
  return { subject, text, html }
}

export type DigestSendResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string }

export const sendInsightsDigest = async (input: {
  productId: string
  insights: Array<{ title: string; body: string }>
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}): Promise<DigestSendResult & { preview: ReturnType<typeof draftDigest> }> => {
  const preview = draftDigest(input.insights, input.productId)
  const env = input.env ?? process.env
  const apiKey = env.RESEND_API_KEY?.trim()
  const to = env.INSIGHTS_DIGEST_TO?.trim()
  if (!apiKey || !to) {
    return {
      sent: false,
      skipped: true,
      reason: 'RESEND_API_KEY or INSIGHTS_DIGEST_TO unset; digest skipped.',
      preview,
    }
  }
  try {
    const fetchImpl = input.fetchImpl ?? fetch
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.WAITLIST_MAIL_FROM?.trim() || 'Synawood <hello@localhost>',
        to: [to],
        subject: preview.subject,
        text: preview.text,
        html: preview.html,
      }),
    })
    if (!response.ok) {
      return {
        sent: false,
        skipped: false,
        reason: `Mail provider ${response.status}`,
        preview,
      }
    }
    return { sent: true, preview }
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'Mail send failed',
      preview,
    }
  }
}
