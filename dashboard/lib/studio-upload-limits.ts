/** Shared Studio multipart upload ceiling (Asset bin, brand images, PDF attach). */
export const STUDIO_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024
export const STUDIO_UPLOAD_MAX_LABEL = '1 GB'
/** Value for `experimental.middlewareClientMaxBodySize` in next.config. */
export const STUDIO_UPLOAD_MAX_CONFIG = '1gb'

export const formatUploadBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return mb >= 100 ? `${Math.round(mb)} MB` : `${Math.round(mb * 10) / 10} MB`
}

export const isStudioUploadOverLimit = (bytes: number): boolean => bytes > STUDIO_UPLOAD_MAX_BYTES
