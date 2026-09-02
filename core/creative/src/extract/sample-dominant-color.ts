import { inflateSync } from 'node:zlib'

const toHex = (r: number, g: number, b: number): string => {
  const rr = Math.max(0, Math.min(255, Math.round(r)))
  const gg = Math.max(0, Math.min(255, Math.round(g)))
  const bb = Math.max(0, Math.min(255, Math.round(b)))
  return `#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`
}

const expandShortHex = (hex: string): string | null => {
  const m = /^#([0-9a-fA-F]{3})$/.exec(hex.trim())
  if (!m) return null
  const [r, g, b] = m[1]!.split('')
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
}

const normalizeHex = (value: string): string | null => {
  const trimmed = value.trim()
  const short = expandShortHex(trimmed)
  if (short) return short
  const full = /^#([0-9a-fA-F]{6})$/.exec(trimmed)
  return full ? `#${full[1]!.toLowerCase()}` : null
}

const isNearWhiteOrBlack = (r: number, g: number, b: number): boolean => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max < 28) return true
  if (min > 235) return true
  return false
}

const isLowSaturation = (r: number, g: number, b: number): boolean => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min < 18
}

type Bucket = { r: number; g: number; b: number; weight: number }

const pushPixel = (buckets: Map<string, Bucket>, r: number, g: number, b: number, a: number) => {
  if (a < 200) return
  if (isNearWhiteOrBlack(r, g, b)) return
  if (isLowSaturation(r, g, b)) return
  // 4-bit quantization keeps the map small
  const qr = r >> 4
  const qg = g >> 4
  const qb = b >> 4
  const key = `${qr},${qg},${qb}`
  const existing = buckets.get(key)
  if (existing) {
    existing.weight += 1
    existing.r += r
    existing.g += g
    existing.b += b
  } else {
    buckets.set(key, { r, g, b, weight: 1 })
  }
}

const winnerHex = (buckets: Map<string, Bucket>): string | undefined => {
  let best: Bucket | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) best = bucket
  }
  if (!best || best.weight < 1) return undefined
  return toHex(best.r / best.weight, best.g / best.weight, best.b / best.weight)
}

/** Extract the most common non-neutral fill/stroke from SVG markup. */
export const sampleColorFromSvg = (svgText: string): string | undefined => {
  const counts = new Map<string, number>()
  const re = /(?:fill|stroke|stop-color|flood-color)\s*[:=]\s*["']?(#[0-9a-fA-F]{3,6})\b/gi
  for (const match of svgText.matchAll(re)) {
    const hex = normalizeHex(match[1] ?? '')
    if (!hex) continue
    const rgb = {
      r: Number.parseInt(hex.slice(1, 3), 16),
      g: Number.parseInt(hex.slice(3, 5), 16),
      b: Number.parseInt(hex.slice(5, 7), 16),
    }
    if (isNearWhiteOrBlack(rgb.r, rgb.g, rgb.b)) continue
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  let best: string | undefined
  let bestCount = 0
  for (const [hex, count] of counts) {
    if (count > bestCount) {
      best = hex
      bestCount = count
    }
  }
  return best
}

const readPngChunk = (
  buffer: Buffer,
  offset: number,
): { type: string; data: Buffer; next: number } | null => {
  if (offset + 12 > buffer.length) return null
  const length = buffer.readUInt32BE(offset)
  const type = buffer.toString('ascii', offset + 4, offset + 8)
  const dataStart = offset + 8
  const dataEnd = dataStart + length
  if (dataEnd + 4 > buffer.length) return null
  return { type, data: buffer.subarray(dataStart, dataEnd), next: dataEnd + 4 }
}

const paethPredictor = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** Unfilter PNG scanlines (types 0–4) into contiguous RGB(A) pixels. */
const unfilterPng = (
  raw: Buffer,
  width: number,
  height: number,
  channels: number,
): Buffer | null => {
  const stride = width * channels
  const out = Buffer.alloc(stride * height)
  let src = 0
  for (let y = 0; y < height; y += 1) {
    if (src >= raw.length) return null
    const filter = raw[src++] ?? 0
    const row = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i += 1) {
      const x = raw[src++] ?? 0
      const left = i >= channels ? (row[i - channels] ?? 0) : 0
      const up = prev ? (prev[i] ?? 0) : 0
      const upLeft = prev && i >= channels ? (prev[i - channels] ?? 0) : 0
      let value = x
      if (filter === 1) value = (x + left) & 255
      else if (filter === 2) value = (x + up) & 255
      else if (filter === 3) value = (x + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) value = (x + paethPredictor(left, up, upLeft)) & 255
      else if (filter !== 0) return null
      row[i] = value
    }
  }
  return out
}

/**
 * Dominant non-neutral color from a PNG (8-bit RGB/RGBA, no interlacing).
 * Returns undefined for unsupported PNG variants (palette, 16-bit, etc.).
 */
export const sampleColorFromPng = (bytes: Buffer): string | undefined => {
  if (bytes.length < 24) return undefined
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!bytes.subarray(0, 8).equals(signature)) return undefined

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = -1
  const idat: Buffer[] = []

  while (offset < bytes.length) {
    const chunk = readPngChunk(bytes, offset)
    if (!chunk) break
    offset = chunk.next
    if (chunk.type === 'IHDR') {
      width = chunk.data.readUInt32BE(0)
      height = chunk.data.readUInt32BE(4)
      bitDepth = chunk.data[8] ?? 0
      colorType = chunk.data[9] ?? -1
      const interlace = chunk.data[12] ?? 0
      if (interlace !== 0) return undefined
    } else if (chunk.type === 'IDAT') {
      idat.push(chunk.data)
    } else if (chunk.type === 'IEND') {
      break
    }
  }

  if (width < 1 || height < 1 || width * height > 4_000_000) return undefined
  if (bitDepth !== 8) return undefined
  // 2 = RGB, 6 = RGBA
  if (colorType !== 2 && colorType !== 6) return undefined

  let raw: Buffer
  try {
    raw = inflateSync(Buffer.concat(idat))
  } catch {
    return undefined
  }

  const channels = colorType === 6 ? 4 : 3
  const pixels = unfilterPng(raw, width, height, channels)
  if (!pixels) return undefined

  const buckets = new Map<string, Bucket>()
  const stepY = Math.max(1, Math.floor(height / 64))
  const stepX = Math.max(1, Math.floor(width / 64))

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * channels
      const r = pixels[i] ?? 0
      const g = pixels[i + 1] ?? 0
      const b = pixels[i + 2] ?? 0
      const a = channels === 4 ? (pixels[i + 3] ?? 255) : 255
      pushPixel(buckets, r, g, b, a)
    }
  }

  return winnerHex(buckets)
}

export const sampleDominantColor = (input: {
  bytes: Buffer
  contentType?: string
  fileName?: string
}): string | undefined => {
  const type = (input.contentType ?? '').toLowerCase()
  const name = (input.fileName ?? '').toLowerCase()
  const isSvg =
    type.includes('svg') ||
    name.endsWith('.svg') ||
    input.bytes.toString('utf8', 0, 200).includes('<svg')
  if (isSvg) {
    return sampleColorFromSvg(input.bytes.toString('utf8'))
  }
  const isPng = type.includes('png') || name.endsWith('.png') || input.bytes[0] === 0x89
  if (isPng) {
    return sampleColorFromPng(input.bytes)
  }
  return undefined
}
