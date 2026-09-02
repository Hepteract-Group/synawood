import { describe, expect, it } from 'vitest'
import { createEmptyProject, parseStudioProject } from './schema'
import { addClip, attachAsset, placeClip, trimClip } from './operations'

const sampleAsset = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'video' as const,
  blobKey: 'local/marketing-os/demo/uploads/p1/take.mp4',
  contentType: 'video/mp4',
  source: 'upload' as const,
  probe: { durationFrames: 300 },
}

describe('studio project schema', () => {
  it('round-trips pipLayout split presets', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const withLayout = parseStudioProject({
      ...project,
      pipLayout: {
        mode: 'split',
        x: 0.58,
        y: 0,
        width: 0.42,
        height: 1,
        axis: 'horizontal',
        mainPct: 0.58,
        mainSide: 'start',
      },
    })
    expect(withLayout.pipLayout?.mode).toBe('split')
    expect(withLayout.pipLayout?.mainPct).toBeCloseTo(0.58)
  })

  it('round-trips an empty talking-head-60 project', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const again = parseStudioProject(JSON.parse(JSON.stringify(project)))
    expect(again).toEqual(project)
    expect(again.compositionId).toBe('talking-head-60')
    expect(again.durationFrames).toBe(1800)
    expect(again.tracks).toHaveLength(6)
    expect(again.tracks.map((track) => track.id)).toEqual([
      'track_video',
      'track_broll',
      'track_audio',
      'track_sfx',
      'track_caption',
      'track_overlay',
    ])
  })

  it('persists an optional founder-facing name', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      name: '  PDF hook  ',
    })
    expect(project.name).toBe('PDF hook')
    expect(parseStudioProject(JSON.parse(JSON.stringify(project))).name).toBe('PDF hook')
  })

  it('adds a caption track when loading a legacy three-track project', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const legacy = {
      ...project,
      tracks: project.tracks.filter((track) => track.type !== 'caption'),
    }
    const again = parseStudioProject(legacy)
    expect(again.tracks.map((track) => track.type)).toContain('caption')
    expect(again.tracks.map((track) => track.id)).toContain('track_broll')
    expect(again.tracks.map((track) => track.id)).toContain('track_sfx')
    expect(again.tracks).toHaveLength(6)
  })

  it('normalizes legacy talking_head_60 composition ids', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const again = parseStudioProject({ ...project, compositionId: 'talking_head_60' })
    expect(again.compositionId).toBe('talking-head-60')
  })

  it('rejects unknown composition ids', () => {
    expect(() =>
      parseStudioProject({
        ...createEmptyProject({
          id: '22222222-2222-4222-8222-222222222222',
          productId: 'demo',
        }),
        compositionId: 'not_a_real_comp',
      }),
    ).toThrow()
  })

  it('defaults empty intent and scenes on legacy documents', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    expect(project.intent).toEqual({ keywords: [] })
    expect(project.scenes).toEqual([])

    const { intent: _i, scenes: _s, ...legacy } = project
    const again = parseStudioProject(legacy)
    expect(again.intent).toEqual({ keywords: [] })
    expect(again.scenes).toEqual([])
  })

  it('round-trips an optional generationPlan (ADR-0086)', () => {
    const base = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const project = parseStudioProject({
      ...base,
      generationPlan: {
        id: '44444444-4444-4444-8444-444444444444',
        status: 'ready',
        goal: 'Drive signups',
        tone: 'trustworthy',
        scenes: [
          {
            id: 'gp_hook',
            role: 'hook',
            description: 'Open on the product screen.',
            dialogue: 'Still juggling PDFs by hand?',
          },
        ],
        extraExtractUrls: ['https://example.com/pricing'],
        reasonerModelId: 'gemini-2.5-flash',
        imageModelId: 'imagen-4',
        videoModelId: 'veo-3',
        costEstimateGbp: 1.2,
        projectRevision: 1,
      },
    })
    expect(project.generationPlan?.tone).toBe('trustworthy')
    expect(project.generationPlan?.scenes[0]?.dialogue).toBe('Still juggling PDFs by hand?')
    expect(project.generationPlan?.reExtractThisTurn).toBe(false)

    const again = parseStudioProject(JSON.parse(JSON.stringify(project)))
    expect(again.generationPlan).toEqual(project.generationPlan)
  })

  it('round-trips intent, scenes, directorPlan, and directorRebuildPrompt', () => {
    const base = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const project = parseStudioProject({
      ...base,
      intent: {
        goal: 'signup',
        platform: 'tiktok',
        emotion: 'emotional',
        lengthSeconds: 15,
        cta: 'Download today',
        keywords: ['focus'],
      },
      scenes: [
        {
          id: 'sc_hook',
          role: 'hook',
          label: 'Hook',
          clipIds: [],
          targetDurationFrames: 90,
        },
      ],
      directorPlan: {
        id: '33333333-3333-4333-8333-333333333333',
        createdAt: '2026-08-03T12:00:00.000Z',
        projectRevision: 1,
        rationale: 'Test stub',
        edits: [],
      },
      directorRebuildPrompt: {
        diffs: ['emotion: exciting → emotional'],
        atRevision: 2,
      },
    })
    const again = parseStudioProject(JSON.parse(JSON.stringify(project)))
    expect(again.intent.platform).toBe('tiktok')
    expect(again.scenes[0]?.role).toBe('hook')
    expect(again.directorPlan?.status).toBe('draft')
    expect(again.directorRebuildPrompt?.diffs).toEqual(['emotion: exciting → emotional'])
  })
})

describe('clip operations', () => {
  it('attaches an asset and places a trimmed clip', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const rev0 = project.revision
    project = attachAsset(project, sampleAsset)
    expect(project.revision).toBe(rev0 + 1)
    project = addClip(project, {
      assetId: sampleAsset.id,
      from: 30,
      durationInFrames: 120,
      trimStartFrames: 15,
    })
    expect(project.clips).toHaveLength(1)
    expect(project.clips[0]?.from).toBe(30)
    expect(project.clips[0]?.trim.startFrames).toBe(15)

    const clipId = project.clips[0]!.id
    project = placeClip(project, clipId, 60)
    project = trimClip(project, clipId, { durationInFrames: 90, trimStartFrames: 20 })
    expect(project.clips[0]?.from).toBe(60)
    expect(project.clips[0]?.durationInFrames).toBe(90)
    expect(project.clips[0]?.trim.startFrames).toBe(20)
  })

  it('grows duration to fit clip placement past the preset end (ADR-0014)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, sampleAsset)
    const next = addClip(project, {
      assetId: sampleAsset.id,
      from: 1750,
      durationInFrames: 120,
    })
    // Auto-fit grows the project instead of rejecting the placement.
    expect(next.durationFrames).toBeGreaterThanOrEqual(1750 + 120)
  })

  it('round-trips an optional applied ExtractedBrief (ADR-0027)', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const withBrief = parseStudioProject({
      ...project,
      brief: {
        id: '33333333-3333-4333-8333-333333333333',
        source: {
          kind: 'url',
          uri: 'https://example.com',
          fetchedAt: '2026-08-02T12:00:00.000Z',
        },
        brandCandidates: { displayName: 'Example' },
        product: { name: 'Example', benefits: ['Fast'] },
        messaging: { hookCandidates: ['Hook'], ctaCandidates: ['Go'] },
        confidence: { overall: 0.7 },
      },
    })
    expect(withBrief.brief?.product.name).toBe('Example')
    expect(parseStudioProject(JSON.parse(JSON.stringify(withBrief))).brief?.id).toBe(
      '33333333-3333-4333-8333-333333333333',
    )
  })

  it('fills layout defaults on legacy overlays and accepts title/sticker kinds', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const stickerAssetId = '44444444-4444-4444-8444-444444444444'
    const parsed = parseStudioProject({
      ...project,
      overlays: [
        { id: 'ov_hook', kind: 'hook_title', text: 'Old hook', from: 0, durationInFrames: 90 },
        {
          id: 'ov_title',
          kind: 'title',
          text: 'Second title',
          from: 90,
          durationInFrames: 90,
        },
        {
          id: 'ov_sticker',
          kind: 'sticker',
          text: '',
          from: 0,
          durationInFrames: 60,
          assetId: stickerAssetId,
        },
      ],
    })
    expect(parsed.overlays[0]?.layout).toEqual({
      x: 0.08,
      y: 0.08,
      width: 0.84,
      height: 0.28,
      rotation: 0,
    })
    expect(parsed.overlays.filter((overlay) => overlay.kind === 'title')).toHaveLength(1)
    expect(parsed.overlays.find((overlay) => overlay.kind === 'sticker')?.assetId).toBe(
      stickerAssetId,
    )
  })

  it('rejects stickers without assetId and text overlays with assetId', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    expect(() =>
      parseStudioProject({
        ...project,
        overlays: [{ id: 'ov_s', kind: 'sticker', from: 0, durationInFrames: 30 }],
      }),
    ).toThrow(/assetId/)
    expect(() =>
      parseStudioProject({
        ...project,
        overlays: [
          {
            id: 'ov_h',
            kind: 'hook_title',
            text: 'Hook',
            from: 0,
            durationInFrames: 90,
            assetId: '44444444-4444-4444-8444-444444444444',
          },
        ],
      }),
    ).toThrow(/assetId/)
  })

  it('round-trips clip treatments', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const parsed = parseStudioProject({
      ...project,
      clips: [
        {
          id: 'clip_1',
          trackId: 'track_video',
          assetId: '11111111-1111-4111-8111-111111111111',
          from: 0,
          durationInFrames: 90,
          trim: { startFrames: 0 },
          treatments: [{ id: 'flash', intensity: 0.3 }],
        },
      ],
    })
    expect(parsed.clips[0]?.treatments).toEqual([{ id: 'flash', intensity: 0.3 }])
  })

  it('accepts authored compositionId and round-trips compositionSource including unicode TSX', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      compositionId: 'authored',
    })
    expect(project.compositionId).toBe('authored')
    expect(project.compositionSource?.source).toBe('')
    expect(project.compositionSource?.motionSeed).toMatch(/^[0-9a-f-]{36}$/i)

    const source = `export default () => <div>你好 🎉</div>`
    const withSource = parseStudioProject({
      ...project,
      compositionSource: {
        source,
        motionSeed: 'seed-motion-1',
        compileError: null,
        compiledAtRevision: 7,
        artDirection: { dialect: 'editorial', layout: 'split-stat' },
      },
    })
    const again = parseStudioProject(JSON.parse(JSON.stringify(withSource)))
    expect(again.compositionId).toBe('authored')
    expect(again.compositionSource?.source).toBe(source)
    expect(again.compositionSource?.motionSeed).toBe('seed-motion-1')
    expect(again.compositionSource?.compiledAtRevision).toBe(7)
    expect(again.compositionSource?.artDirection).toEqual({
      dialect: 'editorial',
      layout: 'split-stat',
    })
  })

  it('generates motionSeed on first write when source is non-empty and seed is missing', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      compositionId: 'authored',
    })
    const parsed = parseStudioProject({
      ...project,
      compositionSource: {
        source: 'export default () => null',
      },
    })
    expect(parsed.compositionSource?.source).toBe('export default () => null')
    expect(parsed.compositionSource?.motionSeed.length).toBeGreaterThan(0)
  })

  it('still loads talking-head projects without compositionSource', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    expect(project.compositionId).toBe('talking-head-60')
    expect(project.compositionSource).toBeUndefined()
    expect(parseStudioProject(JSON.parse(JSON.stringify(project))).compositionId).toBe(
      'talking-head-60',
    )
  })

  it('lists Motion ad on the Create Project format picker (#1326)', async () => {
    const { FORMAT_COMPOSITION_IDS, COMPOSITION_DISPLAY } = await import('./schema')
    expect(FORMAT_COMPOSITION_IDS).toContain('authored')
    expect(COMPOSITION_DISPLAY.authored.label).toBe('Motion ad')
  })

  it('switches Video Suite craft between footage and authored (#1326)', async () => {
    const { applyStudioCraft, createEmptyProject } = await import('./schema')
    const footage = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const motion = applyStudioCraft(footage, 'motion')
    expect(motion.compositionId).toBe('authored')
    expect(motion.compositionSource?.source).toBe('')
    const written = {
      ...motion,
      compositionSource: {
        source: 'export default () => null',
        motionSeed: motion.compositionSource!.motionSeed,
        compileError: null,
      },
    }
    const back = applyStudioCraft(written, 'footage')
    expect(back.compositionId).toBe('talking-head-60')
    expect(back.compositionSource?.source).toBe('export default () => null')
    expect(applyStudioCraft(back, 'motion').compositionSource?.source).toBe(
      'export default () => null',
    )
  })
})
