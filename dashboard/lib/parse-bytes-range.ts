/** Parse a single HTTP Range bytes unit. Open-ended end uses `openEndDefaultLength` when set. */
export const parseBytesRange = (
  header: string | null,
  totalSize: number,
  openEndDefaultLength?: number,
): { start: number; end: number } | null => {
  if (!header || totalSize <= 0) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match) return null
  const startRaw = match[1]
  const endRaw = match[2]
  if (startRaw === '' && endRaw === '') return null

  let start: number
  let end: number
  if (startRaw === '') {
    // suffix: bytes=-500 → last 500 bytes
    const suffix = Number(endRaw)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(0, totalSize - suffix)
    end = totalSize - 1
  } else {
    start = Number(startRaw)
    if (!Number.isFinite(start) || start < 0 || start >= totalSize) return null
    if (endRaw === '') {
      const defaultLen = openEndDefaultLength
      end =
        typeof defaultLen === 'number' && defaultLen > 0
          ? Math.min(totalSize - 1, start + defaultLen - 1)
          : totalSize - 1
    } else {
      end = Number(endRaw)
      if (!Number.isFinite(end) || end < start) return null
      end = Math.min(end, totalSize - 1)
    }
  }
  return { start, end }
}
