export {
  attachBrandKit,
  attachFallbackBrand,
  brandKitRoot,
  buildBrandPromptContext,
  loadBrandKitFiles,
  requireBrand,
} from './attach'
export {
  ensureProductBrandLibrary,
  importProductBrand,
  readProductBrandLibrary,
  seedProductBrandLibraryFromDisk,
} from './library'
export {
  addBrandStillAsset,
  brandPromptContextFromProject,
  clearProjectBrand,
  removeBrandStillAsset,
  setBrandLogoAsset,
  updateProjectBrand,
  uploadBrandImageAsset,
} from './brand-ops'
export type { BrandFieldPatch } from './brand-ops'
export { brandPromptContextSchema, toBrandPromptBlock, withBrandDna } from './prompt-context'
export type { BrandPromptContext } from './prompt-context'
export { productBrandLibrarySchema } from './library-schema'
export type { ProductBrandLibrary } from './library-schema'
export {
  brandDnaSchema,
  emptyBrandDna,
  parseBrandDna,
  brandSliceFromDna,
  DNA_FIELD_KEYS,
  DNA_FIELD_LABELS,
  DNA_FIELD_HINTS,
  isDnaFieldKey,
  dnaFieldPreview,
} from './dna'
export type { BrandDna, BrandDnaBusiness, DnaFieldKey } from './dna'
export {
  catalogItemSchema,
  emptyProductCatalog,
  parseProductCatalog,
  productCatalogSchema,
} from './catalog'
export type { CatalogItem, ProductCatalog } from './catalog'
export { applyDnaDraftFields, extractDnaDraftFromHtml, ingestDnaFromUrl } from './dna-ingest'
export { loadBrandDna, loadProductCatalog } from './product-copy'
export {
  loadProductBrandDna,
  loadProductCatalogRow,
  saveBrandDnaDraft,
  saveProductBrandDna,
  saveProductCatalogRow,
} from './product-copy-store'
