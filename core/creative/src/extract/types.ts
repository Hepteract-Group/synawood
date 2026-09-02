/** Caps for URL/PDF source adapters (ADR-0027 / #150). */
export const EXTRACT_URL_MAX_BYTES = 1_500_000
export const EXTRACT_URL_TIMEOUT_MS = 30_000
export const EXTRACT_URL_DIGEST_MAX_CHARS = 12_000
export const EXTRACT_PDF_MAX_BYTES = 20 * 1024 * 1024
export const EXTRACT_PDF_MAX_PAGES = 20
export const EXTRACT_PDF_MAX_CHARS_PER_PAGE = 4_000

export type ImageCandidateRole = 'og' | 'icon' | 'other'

export type UrlImageCandidate = {
  url: string
  role: ImageCandidateRole
}

export type UrlSourceDigest = {
  kind: 'url'
  finalUrl: string
  title?: string
  description?: string
  textDigest: string
  imageCandidates: UrlImageCandidate[]
  /** theme-color / msapplication-TileColor when present — highest-trust palette signal. */
  themeColor?: string
  colorGuesses: string[]
  fetchedAt: string
  contentType?: string
  bytesRead: number
}

export type PdfPageDigest = {
  page: number
  text: string
}

export type PdfImageCandidate = {
  /** 1-based occurrence index of /Subtype /Image in the file. */
  index: number
  note: string
}

export type PdfSourceDigest = {
  kind: 'pdf'
  pageCount: number
  pages: PdfPageDigest[]
  imageCandidates: PdfImageCandidate[]
  textDigest: string
  fetchedAt: string
  bytesRead: number
}

export type SourceDigest = UrlSourceDigest | PdfSourceDigest
