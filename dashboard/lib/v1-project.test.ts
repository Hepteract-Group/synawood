import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createEmptyProject, summarizeProject } from '@synawood/creative/project'
import { describe, expect, it } from 'vitest'
import { ProductAccessError } from './product-membership'
import { assertApiKeyOwnsProject, v1ProjectReadBody } from './v1-project'

const PROJECT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const KEY_PRODUCT = 'demo'
const OTHER_PRODUCT = 'other-product'

describe('v1 project access (#1073)', () => {
  it('allows a key for the same Product and 403s a key from another Product', () => {
    expect(() => assertApiKeyOwnsProject(KEY_PRODUCT, KEY_PRODUCT)).not.toThrow()
    expect(() => assertApiKeyOwnsProject(KEY_PRODUCT, OTHER_PRODUCT)).toThrow(ProductAccessError)
    try {
      assertApiKeyOwnsProject(KEY_PRODUCT, OTHER_PRODUCT)
    } catch (error) {
      expect(error).toMatchObject({ name: 'ProductAccessError', status: 403 })
    }
  })

  it('maps GET to get_project_summary fields from the project', () => {
    const project = createEmptyProject({
      id: PROJECT_ID,
      productId: KEY_PRODUCT,
      name: 'V1 fixture',
    })
    const body = v1ProjectReadBody(project)
    const summary = summarizeProject(project)
    expect(body.tool).toBe('get_project_summary')
    expect(body.summary).toEqual(summary)
    expect(body.clipIds).toEqual(project.clips.map((clip) => clip.id))
    expect(body.assetIds).toEqual(project.assets.map((asset) => asset.id))
    expect(body.overlays).toEqual(summary.overlays)
    expect(body.project.id).toBe(PROJECT_ID)
    expect(body.project.productId).toBe(KEY_PRODUCT)
  })

  it('v1 project route uses withApiKey and never mcp verbs', () => {
    const route = readFileSync(
      join(process.cwd(), 'app/api/v1/projects/[projectId]/route.ts'),
      'utf8',
    )
    expect(route).toContain('withApiKey')
    expect(route).toContain('v1ProjectReadBody')
    expect(route).toContain('patchV1Project')
    expect(route).not.toMatch(/mcp:/)
  })
})
