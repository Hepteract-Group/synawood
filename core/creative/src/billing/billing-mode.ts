/** Hosted wallet debits apply when billing is on (ADR-0082 / #1039). */
export const isBillingEnabled = (env: Record<string, string | undefined> = process.env): boolean =>
  env.BILLING_MODE !== 'off'
