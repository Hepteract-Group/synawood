import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import {
  planCampaignCreatives,
  setCampaignBrief,
  setCreativeBackground,
} from '../project/campaign-ops'
import { approveCampaignCreatives } from './approve-campaign-creatives'

const retainFinalBlobs = vi.fn(
  async (input: { finalAssetId: string; sourceAssets: Array<{ id: string }> }) => ({
    primaryAssetId: '55555555-5555-4555-8555-555555555555',
    members: [
      {
        assetId: '55555555-5555-4555-8555-555555555555',
        kind: 'image',
        blobKey: 'finals/x.png',
        role: 'primary',
        sourceAssetId: input.sourceAssets[0]!.id,
      },
    ],
  }),
)

vi.mock('./review', async () => {
  const actual = await vi.importActual<typeof import('./review')>('./review')
  return {
    ...actual,
    retainFinalBlobs: (...args: unknown[]) => retainFinalBlobs(...(args as [never])),
  }
})

vi.mock('../project/save', () => ({
  saveProject: vi.fn(async (_supabase, project: { revision: number }) => ({
    project: { ...project, revision: project.revision + 1, status: 'approved' },
  })),
}))

const packProject = () => {
  let project = createEmptyProject({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productId: 'demo',
    compositionId: 'campaign-pack-still',
  })
  project = setCampaignBrief(project, { prompt: 'Calm' })
  project = planCampaignCreatives(project, { headlines: ['One', 'Two'] })
  project = setCreativeBackground(project, {
    creativeId: 'creative_1',
    backgroundAssetId: '11111111-1111-4111-8111-111111111111',
  })
  project = setCreativeBackground(project, {
    creativeId: 'creative_2',
    backgroundAssetId: '22222222-2222-4222-8222-222222222222',
  })
  return project
}

const supabaseWith = () => {
  const inserts: unknown[] = []
  const publishInserts: unknown[] = []
  return {
    inserts,
    publishInserts,
    client: {
      from: (table: string) => {
        if (table === 'assets') {
          return {
            select: () => ({
              in: async (_col: string, ids: string[]) => ({
                data: ids.map((id) => ({
                  id,
                  product_id: 'demo',
                  project_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  kind: 'image',
                  source: 'generator',
                  blob_key: `local/${id}.png`,
                  content_type: 'image/png',
                  probe: {},
                })),
                error: null,
              }),
            }),
          }
        }
        if (table === 'final_assets') {
          return {
            select: () => ({
              eq: () => ({
                filter: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: (row: unknown) => {
              inserts.push(row)
              return {
                select: () => ({
                  single: async () => ({
                    data: { ...(row as object), created_at: 'now' },
                    error: null,
                  }),
                }),
              }
            },
          }
        }
        if (table === 'publish_records') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: async (row: unknown) => {
              publishInserts.push(row)
              return { error: null }
            },
          }
        }
        return {}
      },
    },
  }
}

describe('approveCampaignCreatives (#114)', () => {
  it('creates two finals and two publish records', async () => {
    const stub = supabaseWith()
    const project = packProject()
    const result = await approveCampaignCreatives(
      stub.client as never,
      {
        connectionString: 'x',
        containerName: 'marketing-os',
        useLocalPrefix: true,
        accountName: 'a',
        accountKey: 'k',
      },
      project,
      project.revision,
      { creativeIds: ['creative_1', 'creative_2'] },
    )
    expect(result.finals).toHaveLength(2)
    expect(stub.inserts).toHaveLength(2)
    expect(stub.publishInserts).toHaveLength(2)
    expect(
      (stub.inserts[0] as { attribution: { creative_id: string } }).attribution.creative_id,
    ).toBe('creative_1')
    expect(
      (stub.inserts[1] as { attribution: { creative_id: string } }).attribution.creative_id,
    ).toBe('creative_2')
    expect(
      (stub.inserts[0] as { creative_structure: { beats: unknown[] } }).creative_structure.beats,
    ).toEqual([])
    expect(result.project.status).toBe('approved')
  })
})
