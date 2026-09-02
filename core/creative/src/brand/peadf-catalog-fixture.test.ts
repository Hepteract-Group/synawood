import { describe, expect, it } from 'vitest'
import {
  demoLikeCatalogFixture,
  demoLikeDnaFixture,
  proofNumbersFromCatalog,
  proofNumbersFromDna,
} from './demo-catalog-fixture'

describe('demoLikeCatalogFixture (#1199)', () => {
  it('exposes a Catalog number without baking production claims into the kit', () => {
    const catalog = demoLikeCatalogFixture()
    expect(proofNumbersFromCatalog(catalog)).toEqual([40])
    expect(catalog.items[0]?.claimBounds.join(' ')).not.toMatch(/1000000/)
    expect(proofNumbersFromDna(demoLikeDnaFixture())).toEqual([40])
  })
})
