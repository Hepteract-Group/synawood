/** Reject remote URLs as render sources — Extracts must use owned Blob keys (ADR-0022). */
export const assertOwnedBlobKey = (blobKey: string | null | undefined): void => {
  if (blobKey == null || blobKey.trim() === '') return
  const trimmed = blobKey.trim()
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Extract blob keys must be owned Blob paths, not remote hotlinks')
  }
  if (!trimmed.includes('/')) {
    throw new Error('Extract blob keys must be a storage path, not a bare filename')
  }
}
