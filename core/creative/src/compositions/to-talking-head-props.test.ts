import { describe, expect, it } from 'vitest'
import {
  attachAsset,
  addClip,
  addCaptions,
  addText,
  placeSticker,
  createEmptyProject,
} from '../project/index'
import { toTalkingHeadProps } from './to-talking-head-props'
import { switchProjectLocale } from '../locale/resolve'

describe('toTalkingHeadProps', () => {
  it('maps project clips to Remotion props via blob URL resolver', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/marketing-os/demo/uploads/x.mp4',
      source: 'upload',
      probe: { durationFrames: 120 },
    })
    project = addClip(project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 10,
      durationInFrames: 60,
      trimStartFrames: 5,
    })

    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.clips).toEqual([
      {
        src: 'https://signed.example/local/marketing-os/demo/uploads/x.mp4',
        from: 10,
        durationInFrames: 60,
        trimBefore: 5,
        mediaKind: 'video',
        muted: false,
      },
    ])
  })

  it('maps clip.reframe onto Remotion pan/scan props', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/marketing-os/demo/uploads/x.mp4',
      source: 'upload',
      probe: { durationFrames: 120, width: 1920, height: 1080 },
    })
    project = addClip(project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
      durationInFrames: 60,
    })
    project = {
      ...project,
      clips: project.clips.map((clip) => ({
        ...clip,
        reframe: {
          aspect: '9:16' as const,
          tracking: [{ t: 0, x: 0.3, y: 0, w: 0.4, h: 1 }],
        },
      })),
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.clips[0]?.reframe?.aspect).toBe('9:16')
    expect(props.clips[0]?.reframe?.tracking[0]?.w).toBe(0.4)
  })

  it('maps image clips for Remotion Img (not dropped)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'image',
      blobKey: 'local/marketing-os/demo/generated/golfer.png',
      source: 'generator',
      probe: { prompt: 'a golfer in mid-swing' },
    })
    project = addClip(project, {
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      from: 150,
      durationInFrames: 90,
    })

    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.clips).toEqual([
      {
        src: 'https://signed.example/local/marketing-os/demo/generated/golfer.png',
        from: 150,
        durationInFrames: 90,
        trimBefore: 0,
        mediaKind: 'image',
        muted: false,
      },
    ])
  })

  it('maps audio clips for Remotion Audio (not dropped)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      kind: 'audio',
      blobKey: 'local/marketing-os/demo/generated/vo.mp3',
      source: 'generator',
      contentType: 'audio/mpeg',
      probe: { durationFrames: 120 },
    })
    project = addClip(project, {
      assetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      from: 0,
      durationInFrames: 120,
    })

    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.clips).toEqual([
      {
        src: 'https://signed.example/local/marketing-os/demo/generated/vo.mp3',
        from: 0,
        durationInFrames: 120,
        trimBefore: 0,
        mediaKind: 'audio',
        muted: false,
      },
    ])
  })

  it('marks muted audio-track clips', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'upload',
      probe: { durationFrames: 60 },
    })
    project = addClip(project, {
      assetId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      from: 0,
      durationInFrames: 60,
    })
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.type === 'audio' ? { ...track, muted: true } : track,
      ),
    }
    const props = toTalkingHeadProps(project, () => 'https://signed.example/x')
    expect(props.clips[0]?.muted).toBe(true)
  })

  it('maps Path C brand chrome (logo, colors, default CTA)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '33333333-3333-4333-8333-333333333333',
      kind: 'image',
      blobKey: 'local/marketing-os/demo/brand-kit/logo.svg',
      source: 'brand_kit',
      probe: {},
    })
    project = {
      ...project,
      brand: {
        productId: 'demo',
        logoAssetId: '33333333-3333-4333-8333-333333333333',
        primaryColor: '#1F6B4A',
        accentColor: '#C45C26',
        captionBg: 'rgba(0,0,0,0.7)',
        fontFamily: 'Georgia, serif',
        defaultCta: 'example.com',
      },
      revision: project.revision + 1,
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.logoSrc).toBe('https://signed.example/local/marketing-os/demo/brand-kit/logo.svg')
    expect(props.primaryColor).toBe('#1F6B4A')
    expect(props.endCard).toBe('example.com')
    expect(props.fontFamily).toBe('Georgia, serif')
  })

  it('does not inject defaultCta end card when clips exist (would cover end-screen stills)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'image',
      blobKey: 'local/img.png',
      source: 'generator',
      probe: {},
    })
    project = addClip(project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
      durationInFrames: 90,
    })
    project = {
      ...project,
      brand: {
        productId: 'demo',
        defaultCta: 'example.com',
      },
      revision: project.revision + 1,
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.endCard).toBeUndefined()
  })

  it('passes explicit end_card overlay timing so it does not cover the last clip', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'image',
      blobKey: 'local/img.png',
      source: 'generator',
      probe: {},
    })
    project = addClip(project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
      durationInFrames: 90,
    })
    project = {
      ...project,
      overlays: [
        {
          id: 'overlay_1',
          kind: 'end_card',
          text: 'Get started',
          from: 105,
          durationInFrames: 90,
        },
      ],
      durationFrames: 195,
      revision: project.revision + 1,
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.endCard).toBe('Get started')
    expect(props.endCardFrom).toBe(105)
    expect(props.endCardDurationInFrames).toBe(90)
  })

  it('maps B-roll clips to pipClips inset, not full-bleed', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'video',
      blobKey: 'local/marketing-os/demo/uploads/main.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = attachAsset(project, {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kind: 'video',
      blobKey: 'local/marketing-os/demo/uploads/broll.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, {
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      from: 0,
      durationInFrames: 90,
      trackId: 'track_video',
    })
    project = addClip(project, {
      assetId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      from: 0,
      durationInFrames: 90,
      trackId: 'track_broll',
    })
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.clips).toEqual([
      {
        src: 'https://signed.example/local/marketing-os/demo/uploads/main.mp4',
        from: 0,
        durationInFrames: 90,
        trimBefore: 0,
        mediaKind: 'video',
        muted: false,
      },
    ])
    expect(props.pipClips).toEqual([
      {
        src: 'https://signed.example/local/marketing-os/demo/uploads/broll.mp4',
        from: 0,
        durationInFrames: 90,
        trimBefore: 0,
        mediaKind: 'video',
        muted: false,
      },
    ])
    expect(props.pipLayout?.mode).toBe('split')
    expect(props.pipLayout?.mainPct).toBeCloseTo(0.58)
  })

  it('passes a stored split pipLayout through to composition props', () => {
    let project = createEmptyProject({
      id: '44444444-4444-4444-8444-444444444444',
      productId: 'demo',
    })
    project = {
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
      revision: project.revision + 1,
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.pipLayout?.mode).toBe('split')
    expect(props.pipLayout?.mainPct).toBeCloseTo(0.58)
  })

  it('keeps Path C logoSrc when a style pack is active', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '33333333-3333-4333-8333-333333333333',
      kind: 'image',
      blobKey: 'local/marketing-os/demo/brand-kit/logo.svg',
      source: 'brand_kit',
      probe: {},
    })
    project = {
      ...project,
      stylePackId: 'vhs',
      brand: {
        productId: 'demo',
        logoAssetId: '33333333-3333-4333-8333-333333333333',
        primaryColor: '#1F6B4A',
      },
      revision: project.revision + 1,
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.stylePackId).toBe('vhs')
    expect(props.logoSrc).toBe('https://signed.example/local/marketing-os/demo/brand-kit/logo.svg')
  })

  it('maps title and lower-third overlays onto layout-aware textOverlays', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = addText(project, { kind: 'title', text: 'On-screen type' })
    project = addText(project, { kind: 'lower_third', text: 'the private example · Editor' })
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.textOverlays?.map((overlay) => overlay.kind).sort()).toEqual([
      'lower_third',
      'title',
    ])
    expect(props.textOverlays?.find((overlay) => overlay.kind === 'title')?.text).toBe(
      'On-screen type',
    )
    expect(props.hookTitle).toBeUndefined()
  })

  it('maps caption style.presetId onto CaptionBand presets', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = addCaptions(project, { text: 'Band default' })
    project = addCaptions(project, {
      text: 'Two lines of type',
      from: 90,
      style: { presetId: 'two-line' },
    })
    project = addCaptions(project, {
      text: 'Highlight this',
      from: 180,
      style: { presetId: 'word-highlight' },
    })
    project = addCaptions(project, {
      text: 'Pop this word',
      from: 270,
      style: { presetId: 'karaoke' },
    })
    project = addCaptions(project, {
      text: 'Edit PDFs',
      from: 360,
      style: { presetId: 'karaoke' },
      words: [
        { text: 'Edit', startMs: 12000, endMs: 12400 },
        { text: 'PDFs', startMs: 12400, endMs: 13000 },
      ],
    })
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.captions?.map((caption) => caption.presetId)).toEqual([
      'band',
      'two-line',
      'word-highlight',
      'band',
      'karaoke',
    ])
    expect(props.captions?.at(-1)?.words?.map((word) => word.text)).toEqual(['Edit', 'PDFs'])
  })

  it('maps caption keyword color and marks onto the player (#891)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = addCaptions(project, {
      text: 'Save hours',
      style: {
        presetId: 'karaoke',
        emphasis: [{ wordIndex: 0 }],
        emoji: [{ wordIndex: 0, stickerId: 'sparkle' }],
      },
      words: [
        { text: 'Save', startMs: 0, endMs: 200 },
        { text: 'hours', startMs: 200, endMs: 500 },
      ],
    })
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.captions?.[0]?.emphasis).toEqual([0])
    expect(props.captions?.[0]?.marks?.[0]?.wordIndex).toBe(0)
    expect(props.captions?.[0]?.marks?.[0]?.src).toMatch(/^data:image\/svg/)
  })

  it('maps sticker overlays onto Remotion Img props and keeps logo above', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = placeSticker(project, { stickerId: 'arrow-right', from: 0 })
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.stickers).toHaveLength(1)
    expect(props.stickers?.[0]?.src).toMatch(/stickers\/arrow-right/)
    expect(props.clips).toEqual([])
  })

  it('passes clip.filterId through to composition props', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/marketing-os/demo/uploads/x.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, { assetId: '11111111-1111-4111-8111-111111111111' })
    project = {
      ...project,
      clips: project.clips.map((clip) => ({ ...clip, filterId: 'vhs', filterIntensity: 0.4 })),
      revision: project.revision + 1,
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.clips[0]?.filterId).toBe('vhs')
    expect(props.clips[0]?.filterIntensity).toBe(0.4)
  })

  it('passes clip treatments through to composition props', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/marketing-os/demo/uploads/x.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, { assetId: '11111111-1111-4111-8111-111111111111' })
    project = {
      ...project,
      clips: project.clips.map((clip) => ({
        ...clip,
        treatments: [{ id: 'shake', intensity: 0.7 }],
      })),
    }
    const props = toTalkingHeadProps(project, (key) => `https://signed.example/${key}`)
    expect(props.clips[0]?.treatments).toEqual([{ id: 'shake', intensity: 0.7 }])
  })
})
