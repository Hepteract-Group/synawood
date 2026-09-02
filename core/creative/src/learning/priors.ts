/** Load skill-pack priors: local > product file > pack default (ADR-0036 / #252). Node-only. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergePriors } from './merge'
import type { SkillPriors } from './schema'
import defaultPriors from './priors.default.json'

const here = path.dirname(fileURLToPath(import.meta.url))

export const repoRootFromHere = (): string => path.resolve(here, '../../../..')

export const productPriorsPath = (productId: string, repoRoot = repoRootFromHere()): string =>
  path.join(repoRoot, 'products', productId, 'priors.json')

export const localPriorsPath = (productId: string, repoRoot = repoRootFromHere()): string =>
  path.join(repoRoot, 'products', productId, 'priors.local.json')

const readJsonUnknown = async (filePath: string): Promise<unknown | null> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch {
    return null
  }
}

export const loadPriors = async (input: {
  productId: string
  repoRoot?: string
}): Promise<{ priors: SkillPriors; source: 'local' | 'product' | 'default' }> => {
  const root = input.repoRoot ?? repoRootFromHere()
  const local = await readJsonUnknown(localPriorsPath(input.productId, root))
  const product = await readJsonUnknown(productPriorsPath(input.productId, root))
  const priors = mergePriors(defaultPriors, product, local)
  const source = local ? 'local' : product ? 'product' : 'default'
  return { priors, source }
}

export const writeLocalPriorsBestEffort = async (
  productId: string,
  priors: SkillPriors,
  repoRoot?: string,
): Promise<boolean> => {
  try {
    const filePath = localPriorsPath(productId, repoRoot ?? repoRootFromHere())
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, `${JSON.stringify(priors, null, 2)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}
