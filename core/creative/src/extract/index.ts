export {
  EXTRACT_PDF_MAX_BYTES,
  EXTRACT_PDF_MAX_CHARS_PER_PAGE,
  EXTRACT_PDF_MAX_PAGES,
  EXTRACT_URL_DIGEST_MAX_CHARS,
  EXTRACT_URL_MAX_BYTES,
  EXTRACT_URL_TIMEOUT_MS,
} from './types'
export type {
  ImageCandidateRole,
  PdfImageCandidate,
  PdfPageDigest,
  PdfSourceDigest,
  SourceDigest,
  UrlImageCandidate,
  UrlSourceDigest,
} from './types'

export { UnsafeUrlError, assertSafeFetchUrl, isPrivateOrReservedIp } from './ssrf'
export type { HostLookup } from './ssrf'

export { adaptUrlSource, parseHtmlDigest } from './url-adapter'
export type { FetchLike } from './url-adapter'

export { PdfSourceError, adaptPdfSource, findPdfImageCandidates } from './pdf-adapter'
export type { PdfParseFn } from './pdf-adapter'

export {
  EXTRACT_IMAGE_MAX_BYTES,
  EXTRACT_IMAGE_TIMEOUT_MS,
  fetchSafeBytes,
} from './fetch-safe-bytes'
export {
  sampleColorFromPng,
  sampleColorFromSvg,
  sampleDominantColor,
} from './sample-dominant-color'
export { materializeExtractBrandImages } from './materialize-brand-images'
export type { MaterializedBrandImages } from './materialize-brand-images'
export {
  EXTRACT_CSS_MAX_BYTES_EACH,
  EXTRACT_CSS_MAX_BYTES_TOTAL,
  EXTRACT_CSS_MAX_STYLESHEETS,
  isBrandWorthyColor,
  listStylesheetHrefs,
  normalizeCssHex,
  parseCssColorHits,
  rankCssColors,
} from './css-colors'
export type { CssColorHit } from './css-colors'
export { enrichDigestWithStylesheets } from './url-adapter'
export {
  capturePageScreenshot,
  EXTRACT_SCREENSHOT_MAX_BYTES,
  EXTRACT_SCREENSHOT_TIMEOUT_MS,
} from './capture-page-screenshot'
export { persistExtractScreenshotAsset } from './persist-screenshot-asset'
export { parseVisionQualityScore, scoreScreenshotBytes } from './vision-quality'
export type { ExtractQualityScore } from './vision-quality'
export { assertOwnedBlobKey } from './assert-blob-key'
export { putExtractBlob } from './put-extract-blob'
export { listProductExtracts } from './list-product-extracts'
export { getProductExtract } from './get-product-extract'
export { isPlaceExtractError, placeProductExtractOnProject } from './place-product-extract'
export type { PlaceProductExtractDeps } from './place-product-extract'
export { extractStillAssetIds, nextUnusedExtractSlideBackground } from './prefer-extract-refs'
export { insertProductExtract } from './insert-product-extract'
export { deleteProductExtract, isDeleteExtractError } from './delete-product-extract'
export {
  enqueueProductExtractJob,
  estimateProductExtractEnqueueGbp,
  PRODUCT_EXTRACT_JOB_KIND,
} from './enqueue-product-extract-job'
export { validateProductExtractUrls } from './validate-product-extract-urls'
export { publicHttpUrlsFromText } from './urls-from-text'
export {
  capturePageStills,
  EXTRACT_STILLS_PER_URL_MAX,
  foldScrollYs,
  rankDiscoverLinks,
  rankSectionBoxes,
} from './capture-page-stills'
export { captureSection, isAuthWall } from './capture-section'
export type { SectionCaptureResult, SectionSkipReason } from './capture-section'
export {
  productExtractFromRow,
  productExtractSelect,
  type ProductExtract,
  type ProductExtractKind,
  type ProductExtractQuality,
} from './product-extract-schema'
