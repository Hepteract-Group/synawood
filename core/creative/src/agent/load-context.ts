import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { excerptProductMarketing, summarizeBrandKit } from './system-prompt'

// core/creative/src/agent → repo root
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

export const loadProductMarketingExcerpt = async (productId: string): Promise<string> => {
  const candidates = [
    path.join(repoRoot, 'products', productId, 'product-marketing.md'),
    path.join(process.cwd(), 'products', productId, 'product-marketing.md'),
  ]
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, 'utf8')
      return excerptProductMarketing(raw)
    } catch {
      /* try next */
    }
  }
  return `(No product-marketing.md found for ${productId})`
}

/** Agent context hint only — does not imply Studio defaults a brand onto projects. */
export const loadBrandKitSummary = async (productId: string): Promise<string> => {
  const candidates = [
    path.join(repoRoot, 'products', productId, 'brand-kit', 'colors.json'),
    path.join(process.cwd(), 'products', productId, 'brand-kit', 'colors.json'),
  ]
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, 'utf8')
      const json = JSON.parse(raw) as { primary?: string; primaryColor?: string }
      const ctaCandidates = [
        path.join(path.dirname(candidate), 'manifest.json'),
        path.join(repoRoot, 'products', productId, 'brand-kit', 'manifest.json'),
      ]
      let defaultCta: string | undefined
      for (const manifestPath of ctaCandidates) {
        try {
          const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
            defaultCta?: string
          }
          defaultCta = manifest.defaultCta
          break
        } catch {
          /* try next */
        }
      }
      return summarizeBrandKit({
        productId,
        primaryColor: json.primary ?? json.primaryColor,
        defaultCta,
      })
    } catch {
      /* try next */
    }
  }
  return summarizeBrandKit({ productId })
}
