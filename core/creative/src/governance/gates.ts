/** Shared fail-closed gates for sign-off and owner override (ADR-0042 / #323). */

import { assertClaimScanClear } from './claim-scanner'
import type { ClaimScanResult, ProductRoleName } from './schema'

export const MIN_OVERRIDE_REASON_CHARS = 8
export const MIN_REJECT_REASON_CHARS = 3

export const assertRejectReason = (reason: string): string => {
  const trimmed = reason.trim()
  if (trimmed.length < MIN_REJECT_REASON_CHARS) {
    throw new Error('Rejection requires a short reason.')
  }
  return trimmed
}

export const assertOwnerCanOverride = (role: ProductRoleName, reason: string): string => {
  if (role !== 'owner') {
    throw new Error('Only product owners can override the approval chain.')
  }
  const trimmed = reason.trim()
  if (trimmed.length < MIN_OVERRIDE_REASON_CHARS) {
    throw new Error(
      `Owner override requires a reason (at least ${MIN_OVERRIDE_REASON_CHARS} characters).`,
    )
  }
  return trimmed
}

export const assertDisclaimerPresent = (input: {
  required: boolean
  text: string | null | undefined
  verb: 'Approve' | 'Override'
}): void => {
  if (input.required && !input.text?.trim()) {
    throw new Error(`${input.verb} blocked: policy requires a disclaimer but none is configured.`)
  }
}

/** Claim scanner + disclaimer — override uses the same gates (does not bypass). */
export const assertReadyForFinal = (input: {
  scan: ClaimScanResult
  disclaimerRequired: boolean
  disclaimerText: string | null | undefined
  verb: 'Approve' | 'Override'
}): void => {
  assertClaimScanClear(input.scan)
  assertDisclaimerPresent({
    required: input.disclaimerRequired,
    text: input.disclaimerText,
    verb: input.verb,
  })
}
