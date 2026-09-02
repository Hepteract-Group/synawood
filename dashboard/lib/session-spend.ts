/** Read this project's ledger total from GET /api/studio/projects/[id]/costs. */
export const sessionGbpFromCostsPayload = (body: unknown): number => {
  if (!body || typeof body !== 'object') return 0
  const spent = (body as { spent?: { projectGbp?: unknown } }).spent
  const value = spent?.projectGbp
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}
