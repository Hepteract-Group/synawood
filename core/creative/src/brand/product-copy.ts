/** Load/save Brand DNA and Catalog: git file seed + products.* cache (ADR-0044). */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { brandKitRoot } from './attach'
import { emptyBrandDna, parseBrandDna, type BrandDna } from './dna'
import { emptyProductCatalog, parseProductCatalog, type ProductCatalog } from './catalog'

export const dnaFilePath = (productId: string, repoRoot?: string): string =>
  path.join(brandKitRoot(productId, repoRoot), 'dna.json')

export const catalogFilePath = (productId: string, repoRoot?: string): string => {
  const kit = brandKitRoot(productId, repoRoot)
  return path.join(path.dirname(kit), 'catalog', 'catalog.json')
}

const readJsonUnknown = async (filePath: string): Promise<unknown | null> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch {
    return null
  }
}

export const loadBrandDna = async (input: {
  productId: string
  cache?: unknown | null
  repoRoot?: string
}): Promise<{ dna: BrandDna; source: 'cache' | 'file' | 'empty' }> => {
  if (input.cache != null) {
    return { dna: parseBrandDna(input.cache, input.productId), source: 'cache' }
  }
  const file = await readJsonUnknown(dnaFilePath(input.productId, input.repoRoot))
  if (file) return { dna: parseBrandDna(file, input.productId), source: 'file' }
  return { dna: emptyBrandDna(input.productId), source: 'empty' }
}

export const loadProductCatalog = async (input: {
  productId: string
  cache?: unknown | null
  repoRoot?: string
}): Promise<{ catalog: ProductCatalog; source: 'cache' | 'file' | 'empty' }> => {
  if (input.cache != null) {
    return { catalog: parseProductCatalog(input.cache, input.productId), source: 'cache' }
  }
  const file = await readJsonUnknown(catalogFilePath(input.productId, input.repoRoot))
  if (file) return { catalog: parseProductCatalog(file, input.productId), source: 'file' }
  return { catalog: emptyProductCatalog(input.productId), source: 'empty' }
}

export const writeDnaFileBestEffort = async (
  productId: string,
  dna: BrandDna,
  repoRoot?: string,
): Promise<void> => {
  try {
    await writeFile(dnaFilePath(productId, repoRoot), `${JSON.stringify(dna, null, 2)}\n`, 'utf8')
  } catch {
    /* hosted cannot write git; cache is enough */
  }
}

export const writeCatalogFileBestEffort = async (
  productId: string,
  catalog: ProductCatalog,
  repoRoot?: string,
): Promise<void> => {
  try {
    const filePath = catalogFilePath(productId, repoRoot)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  } catch {
    /* hosted cannot write git; cache is enough */
  }
}
