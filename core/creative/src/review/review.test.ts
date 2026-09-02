import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import type { VariantSpec } from '../variant/schema'

const savedStatus = { value: '' as string }
vi.mock('../project/save.js', () => ({
  saveProject: vi.fn(async (_s: unknown, project: { status: string }) => {
    savedStatus.value = project.status
    return { row: {}, project }
  }),
  RevisionConflictError: class extends Error {},
}))

const blobCalls = {
  gets: [] as string[],
  puts: [] as Array<{ kind: string; parts: string[] }>,
}

vi.mock('../persistence/blob.js', () => ({
  getBlobBytes: vi.fn(async ({ blobKey }: { blobKey: string }) => {
    blobCalls.gets.push(blobKey)
    return Buffer.from('fake-mp4')
  }),
  putBlob: vi.fn(
    async (input: {
      productId: string
      kind: string
      parts: string[]
      data: Buffer
      contentType?: string
    }) => {
      blobCalls.puts.push({ kind: input.kind, parts: input.parts })
      return {
        blobKey: `local/marketing-os/${input.productId}/${input.kind}/${input.parts.join('/')}`,
      }
    },
  ),
}))

vi.mock('../billing/load-hosted-spend-context.js', () => ({
  loadHostedSpendContext: vi.fn(async () => ({
    hasWallet: false,
    walletBalanceGbp: 0,
    generationFrozen: false,
    spentThisMonthGbp: 0,
    spentThisWeekGbp: 0,
    spentThisProjectGbp: 0,
    spentThisMonthFromWalletGbp: 0,
    monthlyGeneratorCapGbp: null,
    planId: 'studio',
    trialEndsAt: null,
    seatLimit: null,
    hasBillingRow: true,
  })),
}))

import { stampPassedCutReview } from '../critic/inspect-preview'
import { LEGAL_KIT_FIXTURE } from '../authored/fixtures'
import { loadHostedSpendContext } from '../billing/load-hosted-spend-context'
import {
  approveProject,
  attachFinalMembersToProject,
  buildFinalAttribution,
  killProject,
  regenerateProject,
} from './review'

const project = (status = 'needs_review') =>
  stampPassedCutReview(
    {
      ...createEmptyProject({ id: '33333333-3333-4333-8333-333333333333', productId: 'demo' }),
      status: status as 'needs_review',
    },
    [0],
  )

const briefId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const parentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const variantSpec: VariantSpec = {
  platform: 'tiktok',
  hookIndex: 0,
  ctaIndex: 1,
  aspect: '9:16',
  label: 'TikTok · Hook 1 · CTA 2',
}

const blobEnv = {
  connectionString: 'UseDevelopmentStorage=true',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'dev',
  accountKey: 'key',
}

/** Minimal supabase stub: completed render + assets + final_assets. */
const supabaseWith = (opts: {
  render?: { id: string; output_asset_ids: string[] } | null
  existingFinal?: { id: string } | null
  insertError?: { code?: string; message: string } | null
  inserts?: Array<Record<string, unknown>>
  assets?: Array<{
    id: string
    kind: string
    source: string
    blob_key: string
    content_type: string | null
    probe: Record<string, unknown>
  }>
}) => {
  const render =
    opts.render === undefined ? { id: 'rj_1', output_asset_ids: ['asset_1'] } : opts.render
  const assets = opts.assets ?? [
    {
      id: 'asset_1',
      kind: 'video',
      source: 'generator',
      blob_key: 'local/marketing-os/demo/renders/p1/rj_1/final.mp4',
      content_type: 'video/mp4',
      probe: { role: 'render_output' },
    },
  ]
  const inserts = opts.inserts ?? []
  return {
    from: vi.fn((table: string) => {
      if (table === 'render_jobs') {
        const q = {
          select: () => q,
          eq: () => q,
          order: () => q,
          limit: () => q,
          maybeSingle: async () => ({ data: render, error: null }),
        }
        return q
      }
      if (table === 'assets') {
        const chain = {
          select: () => ({
            in: async () => ({ data: assets, error: null }),
          }),
          insert: async () => ({ data: null, error: null }),
        }
        return chain
      }
      if (table === 'final_assets') {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: opts.existingFinal ?? null, error: null }),
          single: async () =>
            opts.existingFinal
              ? { data: { id: 'fa_1', members: [] }, error: null }
              : opts.insertError
                ? { data: null, error: opts.insertError }
                : {
                    data: {
                      id: 'fa_new',
                      primary_asset_id: 'retained_1',
                      members: [{ assetId: 'retained_1' }],
                      attribution: inserts.at(-1)?.attribution ?? {},
                    },
                    error: null,
                  },
          insert: (row: Record<string, unknown>) => {
            inserts.push(row)
            return q
          },
        }
        return q
      }
      if (table === 'music_generations') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }
      }
      if (table === 'studio_library_items') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: [], error: null }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('buildFinalAttribution', () => {
  it('returns empty object for a parent cut with no brief', () => {
    expect(buildFinalAttribution({})).toEqual({})
  })

  it('sets trial_export when Approve is under a watermarking plan (#1046)', () => {
    expect(buildFinalAttribution({ trialExport: true })).toEqual({ trial_export: true })
  })

  it('includes brief id for a parent cut with an applied brief', () => {
    expect(buildFinalAttribution({ extractedBriefId: briefId })).toEqual({
      extracted_brief_id: briefId,
    })
  })

  it('includes parent, variant_spec, and brief for a variant child', () => {
    expect(
      buildFinalAttribution({
        parentProjectId: parentId,
        variantSpec,
        extractedBriefId: briefId,
      }),
    ).toEqual({
      parent_project_id: parentId,
      variant_spec: variantSpec,
      extracted_brief_id: briefId,
    })
  })

  it('omits invalid variant_spec instead of failing Approve', () => {
    expect(
      buildFinalAttribution({
        parentProjectId: parentId,
        variantSpec: { platform: 'nope' },
        extractedBriefId: briefId,
      }),
    ).toEqual({
      parent_project_id: parentId,
      extracted_brief_id: briefId,
    })
  })

  it('stores motion_fingerprint for authored Finals', () => {
    expect(
      buildFinalAttribution({
        motionFingerprint: 'snappy|full-bleed-type|export default () => null',
      }),
    ).toEqual({
      motion_fingerprint: 'snappy|full-bleed-type|export default () => null',
    })
  })

  it('leaves motion_fingerprint off ordinary talking-head Approves', () => {
    expect(buildFinalAttribution({})).not.toHaveProperty('motion_fingerprint')
  })
})

describe('approveProject', () => {
  it('copies render blobs into finals/ and marks project approved', async () => {
    blobCalls.gets.length = 0
    blobCalls.puts.length = 0
    const result = await approveProject(supabaseWith({}) as never, blobEnv, project(), 1)
    expect(savedStatus.value).toBe('approved')
    expect(result.finalAsset).toBeTruthy()
    expect(result.alreadyApproved).toBe(false)
    expect(blobCalls.gets).toEqual(['local/marketing-os/demo/renders/p1/rj_1/final.mp4'])
    expect(blobCalls.puts[0]?.kind).toBe('finals')
    expect(blobCalls.puts[0]?.parts.at(-1)).toBe('final.mp4')
    expect(result.project.assets.some((asset) => asset.probe?.name === 'Approved export')).toBe(
      true,
    )
  })

  it('writes variant attribution onto the Final row', async () => {
    const inserts: Array<Record<string, unknown>> = []
    const child = {
      ...project(),
      brief: {
        id: briefId,
        source: {
          kind: 'url' as const,
          uri: 'https://example.com',
          fetchedAt: '2026-08-01T00:00:00.000Z',
        },
        brandCandidates: { stillAssetIds: [] as string[] },
        product: { benefits: [] as string[], socialProof: [] as string[] },
        messaging: {
          hookCandidates: ['Hook'],
          ctaCandidates: ['CTA'],
          audienceHints: [] as string[],
        },
        confidence: { overall: 0.8 },
      },
    }
    await approveProject(supabaseWith({ inserts }) as never, blobEnv, child, 1, {
      parentProjectId: parentId,
      variantSpec,
    })
    expect(inserts[0]?.attribution).toEqual({
      parent_project_id: parentId,
      variant_spec: variantSpec,
      extracted_brief_id: briefId,
    })
  })

  it('writes empty attribution for a non-variant Approve without a brief', async () => {
    const inserts: Array<Record<string, unknown>> = []
    await approveProject(supabaseWith({ inserts }) as never, blobEnv, project(), 1)
    expect(inserts[0]?.attribution).toEqual({})
    expect(inserts[0]?.attribution).not.toHaveProperty('trial_export')
    expect(inserts[0]?.attribution).not.toHaveProperty('motion_fingerprint')
  })

  it('writes motion_fingerprint for an authored Approve (#1192)', async () => {
    const inserts: Array<Record<string, unknown>> = []
    const authored = stampPassedCutReview(
      {
        ...createEmptyProject({ id: '33333333-3333-4333-8333-333333333333', productId: 'demo' }),
        status: 'needs_review' as const,
        compositionId: 'authored' as const,
        compositionSource: {
          source: LEGAL_KIT_FIXTURE,
          motionSeed: 'seed-approve-1',
          artDirection: { dialect: 'snappy', layout: 'full-bleed-type' },
          compileError: null,
          compiledAtRevision: 1,
        },
      },
      [0],
    )
    await approveProject(supabaseWith({ inserts }) as never, blobEnv, authored, 1)
    expect(inserts[0]?.attribution).toMatchObject({
      motion_fingerprint: expect.stringMatching(/^snappy\|full-bleed-type\|/),
    })
  })

  it('stamps trial_export when the org plan watermarks exports (#1046)', async () => {
    vi.mocked(loadHostedSpendContext).mockResolvedValueOnce({
      hasWallet: true,
      walletBalanceGbp: 0,
      generationFrozen: false,
      spentThisMonthGbp: 0,
      spentThisWeekGbp: 0,
      spentThisProjectGbp: 0,
      spentThisMonthFromWalletGbp: 0,
      monthlyGeneratorCapGbp: null,
      planId: 'trial',
      trialEndsAt: null,
      seatLimit: 3,
      hasBillingRow: true,
    })
    const inserts: Array<Record<string, unknown>> = []
    await approveProject(supabaseWith({ inserts }) as never, blobEnv, project(), 1)
    expect(inserts[0]?.attribution).toEqual({ trial_export: true })
  })

  it('snapshots creativeStructure onto the Final row (#231)', async () => {
    const inserts: Array<Record<string, unknown>> = []
    const cut = {
      ...project(),
      creativeStructure: {
        beats: [{ kind: 'hook' as const, from: 0, durationInFrames: 45, sceneId: 'sc_h' }],
        source: 'intent_scenes' as const,
        derivedAt: '2026-08-17T09:00:00.000Z',
      },
    }
    await approveProject(supabaseWith({ inserts }) as never, blobEnv, cut, 1)
    expect(inserts[0]?.creative_structure).toEqual(cut.creativeStructure)
  })

  it('does not rewrite creative_structure on an existing Final (#236)', async () => {
    const inserts: Array<Record<string, unknown>> = []
    const cut = {
      ...project(),
      creativeStructure: {
        beats: [{ kind: 'cta' as const, from: 0, durationInFrames: 30 }],
        source: 'manual' as const,
      },
    }
    await approveProject(
      supabaseWith({ existingFinal: { id: 'fa_1' }, inserts }) as never,
      blobEnv,
      cut,
      1,
    )
    expect(inserts).toEqual([])
  })

  it('is idempotent when a Final already exists for the render', async () => {
    blobCalls.gets.length = 0
    blobCalls.puts.length = 0
    const result = await approveProject(
      supabaseWith({ existingFinal: { id: 'fa_1' } }) as never,
      blobEnv,
      project(),
      1,
    )
    expect(result.alreadyApproved).toBe(true)
    expect(blobCalls.gets).toEqual([])
    expect(blobCalls.puts).toEqual([])
  })

  it('refuses to approve without a completed render', async () => {
    await expect(
      approveProject(supabaseWith({ render: null }) as never, blobEnv, project(), 1),
    ).rejects.toThrow(/completed render/)
  })

  it('refuses to approve a killed project', async () => {
    await expect(
      approveProject(supabaseWith({}) as never, blobEnv, project('killed'), 1),
    ).rejects.toThrow(/killed/)
  })

  it('refuses to approve mock lip-sync provenance', async () => {
    const blocked = {
      ...project(),
      assets: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'video' as const,
          blobKey: 'local/a.mp4',
          source: 'generator' as const,
          probe: {
            voiceProvenance: { kind: 'lipsync', modelId: 'mock-lipsync', stub: true },
          },
        },
      ],
    }
    await expect(approveProject(supabaseWith({}) as never, blobEnv, blocked, 1)).rejects.toThrow(
      /mock lip-sync/,
    )
  })

  it('refuses to approve a video cut without a fresh cut review', async () => {
    const raw = {
      ...createEmptyProject({ id: '33333333-3333-4333-8333-333333333333', productId: 'demo' }),
      status: 'needs_review' as const,
    }
    await expect(approveProject(supabaseWith({}) as never, blobEnv, raw, 1)).rejects.toThrow(
      /cut review/,
    )
  })
})

describe('attachFinalMembersToProject (#1273)', () => {
  it('adds labelled Finals and skips duplicates', () => {
    const base = createEmptyProject({
      id: '33333333-3333-4333-8333-333333333333',
      productId: 'demo',
    })
    const member = {
      assetId: '55555555-5555-4555-8555-555555555555',
      kind: 'video',
      blobKey: 'finals/cut.mp4',
      role: 'final_primary',
      sourceAssetId: '66666666-6666-4666-8666-666666666666',
    }
    const once = attachFinalMembersToProject(base, [member])
    expect(once.assets).toHaveLength(base.assets.length + 1)
    expect(once.assets.at(-1)?.probe?.name).toBe('Approved export')
    const twice = attachFinalMembersToProject(once, [member])
    expect(twice.assets).toHaveLength(once.assets.length)
  })
})

describe('killProject / regenerateProject', () => {
  it('kill marks the project killed', async () => {
    await killProject({} as never, project(), 1)
    expect(savedStatus.value).toBe('killed')
  })

  it('regenerate returns the project to drafting', async () => {
    await regenerateProject({} as never, project('approved'), 1)
    expect(savedStatus.value).toBe('drafting')
  })
})
