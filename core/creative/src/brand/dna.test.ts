import { describe, expect, it } from 'vitest'
import { applyDnaDraftFields, extractDnaDraftFromHtml } from './dna-ingest'
import {
  dnaFieldPreview,
  emptyBrandDna,
  parseBrandDna,
  brandSliceFromDna,
  DNA_FIELD_LABELS,
} from './dna'
import { emptyProductCatalog, parseProductCatalog } from './catalog'
import { loadBrandDna, loadProductCatalog } from './product-copy'

describe('Brand DNA (#104)', () => {
  it('parses demo seed file', async () => {
    const { dna, source } = await loadBrandDna({ productId: 'demo' })
    expect(source).toBe('file')
    expect(dna.tagline).toMatch(/cut/i)
    expect(dna.lockedFields).toEqual([])
  })

  it('prefers cache over file', async () => {
    const { dna, source } = await loadBrandDna({
      productId: 'demo',
      cache: { tagline: 'Cached tagline', values: ['one'] },
    })
    expect(source).toBe('cache')
    expect(dna.tagline).toBe('Cached tagline')
  })

  it('returns empty DNA when nothing is seeded', async () => {
    const { dna, source } = await loadBrandDna({ productId: 'does-not-exist' })
    expect(source).toBe('empty')
    expect(dna).toEqual(emptyBrandDna('does-not-exist'))
  })

  it('builds a project brand slice from DNA without a disk kit', () => {
    const slice = brandSliceFromDna(
      parseBrandDna(
        { tagline: 'Cut the PDF tax', offer: 'Try the private example', business: { legalName: 'Okiki Alaso' } },
        'demo-reader',
      ),
    )
    expect(slice).toEqual({
      productId: 'demo-reader',
      displayName: 'Okiki Alaso',
      defaultCta: 'Try the private example',
    })
  })
})

describe('URL ingest draft (#106)', () => {
  it('extracts title and description without applying', () => {
    const html = `
      <html><head>
        <title>Acme — edit docs</title>
        <meta name="description" content="Private workspace" />
        <meta property="og:url" content="https://example.com/" />
      </head></html>
    `
    const draft = extractDnaDraftFromHtml(html, 'https://example.com', 'demo')
    expect(draft.tagline).toContain('Acme')
    expect(draft.offer).toContain('Private workspace')
    expect(draft.business.url).toContain('example.com')
  })

  it('Apply copies only selected unlocked fields', () => {
    const current = parseBrandDna(
      {
        tagline: 'Keep me',
        icp: 'Locked ICP',
        offer: 'Old offer',
        lockedFields: ['icp'],
      },
      'demo',
    )
    const draft = parseBrandDna(
      {
        tagline: 'New tagline',
        icp: 'Should not land',
        offer: 'New offer',
      },
      'demo',
    )
    const next = applyDnaDraftFields({
      current,
      draft,
      fields: ['tagline', 'icp', 'offer'],
    })
    expect(next.tagline).toBe('New tagline')
    expect(next.offer).toBe('New offer')
    expect(next.icp).toBe('Locked ICP')
  })

  it('previews live vs draft field values', () => {
    const current = parseBrandDna({ tagline: 'Keep me' }, 'demo')
    const draft = parseBrandDna({ tagline: 'New tagline' }, 'demo')
    expect(dnaFieldPreview(current, 'tagline')).toBe('Keep me')
    expect(dnaFieldPreview(draft, 'tagline')).toBe('New tagline')
  })
})

describe('Brand DNA labels (#760)', () => {
  it('spells out abbreviations in field labels', () => {
    const joined = Object.values(DNA_FIELD_LABELS).join(' | ')
    expect(joined).not.toMatch(/\bICP\b/)
    expect(joined).not.toMatch(/\bURL\b/)
    expect(joined).not.toMatch(/\bLocale\b/)
    expect(DNA_FIELD_LABELS.icp.toLowerCase()).toContain('ideal customer')
    expect(DNA_FIELD_LABELS['business.url'].toLowerCase()).toContain('website')
    expect(DNA_FIELD_LABELS['business.locale'].toLowerCase()).toContain('language')
  })
})

describe('Product Catalog (#107)', () => {
  it('returns empty catalog when demo has no catalog.json', async () => {
    const { catalog, source } = await loadProductCatalog({ productId: 'demo' })
    expect(source).toBe('empty')
    expect(catalog.items).toEqual([])
  })

  it('rejects merging catalog into a non-object', () => {
    expect(parseProductCatalog(null, 'demo')).toEqual(emptyProductCatalog('demo'))
  })
})
