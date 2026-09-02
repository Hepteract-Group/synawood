/// <reference path="./pdf-parse-shim.d.ts" />
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import {
  EXTRACT_PDF_MAX_BYTES,
  EXTRACT_PDF_MAX_CHARS_PER_PAGE,
  EXTRACT_PDF_MAX_PAGES,
  type PdfImageCandidate,
  type PdfSourceDigest,
} from './types'

export class PdfSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfSourceError'
  }
}

export type PdfParseFn = (
  dataBuffer: Buffer,
  options?: { max?: number },
) => Promise<{ text: string; numpages: number }>

const isPdfMagic = (bytes: Uint8Array): boolean => {
  if (bytes.byteLength < 5) return false
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) // %PDF-
}

/** Count /Subtype /Image markers as lightweight embedded-image candidates. */
export const findPdfImageCandidates = (bytes: Uint8Array): PdfImageCandidate[] => {
  const text = new TextDecoder('latin1').decode(bytes)
  const matches = text.match(/\/Subtype\s*\/Image\b/g) ?? []
  return matches.slice(0, 40).map((_, index) => ({
    index: index + 1,
    note: 'Embedded image reference (bytes not extracted in v1)',
  }))
}

const splitPages = (fullText: string, maxPages: number, maxChars: number) => {
  const rawPages = fullText.includes('\f') ? fullText.split('\f') : [fullText]
  return rawPages.slice(0, maxPages).map((pageText, index) => ({
    page: index + 1,
    text: pageText.replace(/\s+/g, ' ').trim().slice(0, maxChars),
  }))
}

export const adaptPdfSource = async (input: {
  bytes: Uint8Array | Buffer
  maxBytes?: number
  maxPages?: number
  maxCharsPerPage?: number
  now?: () => Date
  /** Injectable for tests — defaults to pdf-parse. */
  parsePdf?: PdfParseFn
}): Promise<PdfSourceDigest> => {
  const maxBytes = input.maxBytes ?? EXTRACT_PDF_MAX_BYTES
  const maxPages = input.maxPages ?? EXTRACT_PDF_MAX_PAGES
  const maxChars = input.maxCharsPerPage ?? EXTRACT_PDF_MAX_CHARS_PER_PAGE
  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes)
  const parsePdf = input.parsePdf ?? (pdfParse as PdfParseFn)

  if (bytes.byteLength === 0) {
    throw new PdfSourceError('PDF is empty')
  }
  if (bytes.byteLength > maxBytes) {
    throw new PdfSourceError(`PDF exceeds ${maxBytes} bytes`)
  }
  if (!isPdfMagic(bytes)) {
    throw new PdfSourceError('File does not look like a PDF')
  }

  const buffer = Buffer.from(bytes)
  let parsed: { text: string; numpages: number }
  try {
    parsed = await parsePdf(buffer, { max: maxPages })
  } catch (error) {
    throw new PdfSourceError(error instanceof Error ? error.message : 'PDF parse failed')
  }

  const pages = splitPages(parsed.text ?? '', maxPages, maxChars).filter((page) => page.text)
  const pageCount = Math.min(parsed.numpages || pages.length, maxPages)
  const textDigest = pages
    .map((page) => page.text)
    .join('\n\n')
    .slice(0, maxPages * maxChars)

  return {
    kind: 'pdf',
    pageCount: pageCount || pages.length,
    pages,
    imageCandidates: findPdfImageCandidates(bytes),
    textDigest,
    fetchedAt: (input.now ?? (() => new Date()))().toISOString(),
    bytesRead: bytes.byteLength,
  }
}
