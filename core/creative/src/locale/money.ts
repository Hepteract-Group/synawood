/** Money formatting for locale copy (#332 / #510). */

import type { MoneySlice } from './schema'

export const formatProjectMoney = (
  money: MoneySlice | undefined,
  locale: string,
): string | null => {
  if (money?.amountMinor == null) return null
  const amount = money.amountMinor / 100
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
    }).format(amount)
  } catch {
    return `${money.currency} ${amount.toFixed(2)}`
  }
}

/** Trailing ` · £12.99`, ` · 12,99 €`, or fallback ` · GBP 12.99` from a previous apply. */
const TRAILING_PRICE_SUFFIX = /\s*·\s*(?:\p{Sc}\s*)?(?:[A-Z]{3}\s+)?\d[\d.,]*(?:\s*\p{Sc})?\s*$/u

export const applyMoneyToCta = (
  cta: string | undefined,
  formatted: string | null,
): string | undefined => {
  if (!formatted) return cta
  const raw = (cta ?? '').trim()
  if (!raw || raw === formatted) return formatted
  if (raw.includes(formatted)) return raw
  const stripped = raw.replace(TRAILING_PRICE_SUFFIX, '').trim()
  if (!stripped) return formatted
  if (stripped.includes(formatted)) return stripped
  return `${stripped} · ${formatted}`
}
