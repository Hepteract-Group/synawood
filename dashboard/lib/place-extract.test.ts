import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('place extract still (#1096)', () => {
  it('inspector shows still, source URL, score, Place on cut, and Delete', () => {
    const bin = read('components/studio/ExtractsBin.tsx')
    expect(bin).toMatch(/Place on cut/)
    expect(bin).toMatch(/Source URL/)
    expect(bin).toMatch(/Score/)
    expect(bin).toMatch(/Quality note/)
    expect(bin).toMatch(/asset-lightbox/)
    expect(bin).toMatch(/extract-card-delete/)
    expect(bin).toMatch(/>\s*Delete\s*</)
    expect(bin).toMatch(/Delete this extract\?/)
    expect(bin).toMatch(/method: 'DELETE'/)
  })

  it('delete route removes the Product Extract, not a project-only copy', () => {
    const route = read('app/api/products/[productId]/extracts/[extractId]/route.ts')
    expect(route).toMatch(/deleteProductExtract/)
    expect(route).toMatch(/method:\s*'DELETE'|export const DELETE/)
  })

  it('rejected stills stay clickable and Place is not gated on quality', () => {
    const bin = read('components/studio/ExtractsBin.tsx')
    expect(bin).toMatch(/canPlace = item\.kind !== 'text'/)
    expect(bin).not.toMatch(/quality === 'reject'[\s\S]{0,80}canPlace/)
    expect(bin).toMatch(/is-reject/)
  })

  it('place route copies Blob-backed extracts, not remote URLs', () => {
    const route = read('app/api/studio/projects/[projectId]/extracts/[extractId]/place/route.ts')
    expect(route).toMatch(/placeProductExtractOnProject/)
    expect(route).not.toMatch(/sourceUrl.*blobKey/)
  })
})
