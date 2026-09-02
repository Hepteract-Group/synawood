import { emptyBrandDna, type BrandDna } from './dna'
import { type ProductCatalog } from './catalog'
import { numbersInText } from '../authored/proof-numbers'

/**
 * Test/demo Catalog snapshot. Fixture numbers only — do not copy production
 * the private example claims into the motion kit.
 */
export const demoLikeCatalogFixture = (): ProductCatalog => ({
  productId: 'demo-fixture',
  items: [
    {
      id: 'in-browser-editor',
      name: 'In-browser PDF editor',
      summary: 'Edit PDFs in the browser without Adobe.',
      claimBounds: ['40 hours back on tender prep'],
      forbiddenClaims: ['HIPAA compliant'],
    },
  ],
})

export const demoLikeDnaFixture = (): BrandDna => ({
  ...emptyBrandDna('demo-fixture'),
  tagline: 'Edit PDFs in your browser',
  proofPoints: ['40 hours back on tender prep'],
})

export const proofNumbersFromCatalog = (catalog: ProductCatalog): number[] => [
  ...new Set(catalog.items.flatMap((item) => item.claimBounds.flatMap(numbersInText))),
]

export const proofNumbersFromDna = (dna: BrandDna): number[] => [
  ...new Set(dna.proofPoints.flatMap(numbersInText)),
]
