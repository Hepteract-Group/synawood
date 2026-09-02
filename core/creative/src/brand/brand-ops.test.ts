import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import {
  addBrandStillAsset,
  brandPromptContextFromProject,
  clearProjectBrand,
  removeBrandStillAsset,
  setBrandLogoAsset,
  updateProjectBrand,
} from './brand-ops'

const base = () =>
  createEmptyProject({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productId: 'demo',
  })

describe('brand-ops', () => {
  it('builds prompt context from project brand without disk kit', () => {
    const project = updateProjectBrand(base(), {
      primaryColor: '#112233',
      defaultCta: 'Try demo',
      mood: 'sharp',
      displayName: 'Demo',
    })
    const ctx = brandPromptContextFromProject(project)
    expect(ctx.defaultCta).toBe('Try demo')
    expect(ctx.paletteHex).toContain('#112233')
  })

  it('sets logo and stills then clears brand', () => {
    let project = base()
    const logo = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kind: 'image' as const,
      blobKey: 'x/logo.png',
      contentType: 'image/png',
      source: 'upload' as const,
      probe: {},
    }
    const still = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      kind: 'image' as const,
      blobKey: 'x/still.png',
      contentType: 'image/png',
      source: 'upload' as const,
      probe: {},
    }
    project = setBrandLogoAsset(project, { asset: logo })
    project = addBrandStillAsset(project, still, { makePrimary: true })
    expect(project.brand?.logoAssetId).toBe(logo.id)
    expect(project.brand?.stillAssetIds).toEqual([still.id])
    project = removeBrandStillAsset(project, still.id)
    expect(project.brand?.stillAssetIds ?? []).toHaveLength(0)
    project = clearProjectBrand(project)
    expect(project.brand).toBeUndefined()
    expect(project.assets.some((asset) => asset.id === logo.id)).toBe(false)
  })

  it('stores chrome layout on brand', () => {
    const project = updateProjectBrand(base(), {
      chrome: { corner: 'bottom-left', scale: 1.5, safeMargin: 24 },
    })
    expect(project.brand?.chrome?.corner).toBe('bottom-left')
    expect(project.brand?.chrome?.scale).toBe(1.5)
  })
})
