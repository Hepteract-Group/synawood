/**
 * Env flag for marketplace adapter stubs (ADR-0027).
 * Off by default — only `true` / `1` / `yes` (case-insensitive) enable.
 */
export const isMarketplaceAdaptersEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env.MARKETPLACE_ADAPTERS?.trim().toLowerCase()
  if (!raw) return false
  return raw === 'true' || raw === '1' || raw === 'yes'
}
