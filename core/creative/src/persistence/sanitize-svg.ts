/**
 * Browsers parse SVG as XML 1.0 when embedded as an image. Illegal control
 * bytes (e.g. 0x14) make the rasterization fail even when blob storage returns
 * HTTP 200 with image/svg+xml.
 */
export const sanitizeSvgBytes = (bytes: Buffer | Uint8Array): Buffer => {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const text = buf.toString('utf8')
  const looksSvg = /^\s*<\?xml/i.test(text) || /^\s*<svg[\s>]/i.test(text) || text.includes('<svg')
  if (!looksSvg) return buf
  return Buffer.from(text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''), 'utf8')
}

export const isSvgContentType = (contentType: string | undefined): boolean =>
  Boolean(contentType && /image\/svg\+xml/i.test(contentType))
