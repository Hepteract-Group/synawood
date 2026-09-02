/** Sticker PNG/WebP must have alpha so they cannot cover the ad (ADR-0059). */

export const pngHasAlpha = (bytes: Uint8Array): boolean => {
  if (bytes.length < 25) return false
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < png.length; i += 1) {
    if (bytes[i] !== png[i]) return false
  }
  const colorType = bytes[25]
  if (colorType === 4 || colorType === 6) return true
  const text = Buffer.from(bytes).toString('binary')
  return text.includes('tRNS')
}

export const webpHasAlpha = (bytes: Uint8Array): boolean => {
  if (bytes.length < 16) return false
  const riff = Buffer.from(bytes.subarray(0, 4)).toString('ascii')
  const webp = Buffer.from(bytes.subarray(8, 12)).toString('ascii')
  if (riff !== 'RIFF' || webp !== 'WEBP') return false
  const chunk = Buffer.from(bytes.subarray(12, 16)).toString('ascii')
  if (chunk === 'VP8L') return true
  if (chunk === 'VP8X' && bytes.length > 20) {
    return Boolean((bytes[20] ?? 0) & 0x10)
  }
  return false
}

export const assertStickerHasAlpha = (input: { bytes: Uint8Array; contentType: string }): void => {
  const type = input.contentType.toLowerCase()
  if (type.includes('png')) {
    if (!pngHasAlpha(input.bytes)) {
      throw new Error(
        'Sticker failed QC: PNG needs transparency. An opaque full-frame image would cover the ad.',
      )
    }
    return
  }
  if (type.includes('webp')) {
    if (!webpHasAlpha(input.bytes)) {
      throw new Error(
        'Sticker failed QC: WebP needs transparency. An opaque full-frame image would cover the ad.',
      )
    }
    return
  }
  if (type.includes('svg')) {
    const text = Buffer.from(input.bytes).toString('utf8')
    if (/<script|foreignObject/i.test(text)) {
      throw new Error('Sticker SVG cannot include script or foreignObject.')
    }
    return
  }
  throw new Error('Stickers must be PNG, WebP, or SVG.')
}
