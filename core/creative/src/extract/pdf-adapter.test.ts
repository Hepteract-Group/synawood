import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { adaptPdfSource, findPdfImageCandidates, PdfSourceError } from './pdf-adapter'

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sample.pdf')

describe('adaptPdfSource', () => {
  it('extracts text from a real PDF fixture', async () => {
    const bytes = new Uint8Array(readFileSync(fixturePath))
    const digest = await adaptPdfSource({
      bytes,
      maxPages: 2,
      maxCharsPerPage: 500,
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    })
    expect(digest.kind).toBe('pdf')
    expect(digest.bytesRead).toBe(bytes.byteLength)
    expect(digest.pages.length).toBeGreaterThan(0)
    expect(digest.pages[0]?.text.length).toBeGreaterThan(0)
    expect(digest.pages[0]?.text.length).toBeLessThanOrEqual(500)
    expect(digest.fetchedAt).toBe('2026-08-02T12:00:00.000Z')
  })

  it('honors injectable parsePdf and page/char caps', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 fake')
    const digest = await adaptPdfSource({
      bytes,
      maxPages: 2,
      maxCharsPerPage: 10,
      parsePdf: async () => ({
        numpages: 5,
        text: 'AAAAAAAAAAAA\fBBBBBBBBBBBB\fCCCCCCCCCCCC',
      }),
    })
    expect(digest.pageCount).toBe(2)
    expect(digest.pages).toHaveLength(2)
    expect(digest.pages[0]?.text).toBe('AAAAAAAAAA')
    expect(digest.pages[1]?.text).toBe('BBBBBBBBBB')
  })

  it('rejects non-PDF magic and oversized buffers', async () => {
    await expect(adaptPdfSource({ bytes: new Uint8Array([1, 2, 3]) })).rejects.toBeInstanceOf(
      PdfSourceError,
    )
    const huge = new Uint8Array(2000)
    huge.set([0x25, 0x50, 0x44, 0x46, 0x2d])
    await expect(adaptPdfSource({ bytes: huge, maxBytes: 100 })).rejects.toBeInstanceOf(
      PdfSourceError,
    )
  })
})

describe('findPdfImageCandidates', () => {
  it('counts Subtype Image markers', () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 /Subtype /Image /Subtype/Image')
    expect(findPdfImageCandidates(bytes)).toHaveLength(2)
  })
})
