import { describe, expect, it } from 'vitest'
import { toAuthoredPlate } from './bind-authored-stills'
import {
  authoredAudioClock,
  authoredIframeInputProps,
  hydrateAuthoredInputProps,
  parseAuthoredAudioClips,
  toAuthoredInputProps,
} from './input-props'
import { attachAsset, addClip, createEmptyProject } from '../project'

const projectId = '22222222-2222-4222-8222-222222222222'
const audioId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('toAuthoredInputProps audio beds (#1257)', () => {
  it('maps timeline audio clips so the authored Player can play them', () => {
    let project = createEmptyProject({ id: projectId, productId: 'demo' })
    project = {
      ...project,
      compositionId: 'authored',
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-audio-1',
        compileError: null,
      },
    }
    project = attachAsset(project, {
      id: audioId,
      kind: 'audio',
      blobKey: 'local/marketing-os/demo/generated/bed.mp3',
      source: 'generator',
      contentType: 'audio/mpeg',
      probe: { durationFrames: 450 },
    })
    project = addClip(project, {
      assetId: audioId,
      from: 0,
      durationInFrames: 450,
    })

    const props = toAuthoredInputProps(project, (key) => `https://blobs.example/${key}`)
    expect(props.audioClips).toEqual([
      {
        src: 'https://blobs.example/local/marketing-os/demo/generated/bed.mp3',
        from: 0,
        durationInFrames: 450,
        trimBefore: 0,
        muted: false,
      },
    ])
  })

  it('omits hidden tracks and marks muted tracks', () => {
    let project = createEmptyProject({ id: projectId, productId: 'demo' })
    project = attachAsset(project, {
      id: audioId,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, {
      assetId: audioId,
      from: 12,
      durationInFrames: 90,
      trimStartFrames: 6,
    })
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.type === 'audio' ? { ...track, muted: true } : track,
      ),
    }

    const props = toAuthoredInputProps(project, () => 'https://blobs.example/bed.mp3')
    expect(props.audioClips[0]?.muted).toBe(true)
    expect(props.audioClips[0]?.from).toBe(12)
    expect(props.audioClips[0]?.trimBefore).toBe(6)

    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.type === 'audio' ? { ...track, hidden: true, muted: false } : track,
      ),
    }
    const hidden = toAuthoredInputProps(project, () => 'https://blobs.example/bed.mp3')
    expect(hidden.audioClips).toEqual([])
  })
})

describe('parseAuthoredAudioClips', () => {
  it('reads clips from inputProps and drops malformed rows', () => {
    expect(
      parseAuthoredAudioClips({
        audioClips: [
          { src: 'https://blobs.example/a.mp3', from: 0, durationInFrames: 30 },
          { src: '', from: 0, durationInFrames: 30 },
          { from: 0, durationInFrames: 30 },
        ],
      }),
    ).toEqual([{ src: 'https://blobs.example/a.mp3', from: 0, durationInFrames: 30 }])
  })
})

describe('authoredIframeInputProps (#1265)', () => {
  it('drops audioClips so the unique-origin iframe does not wait on Azure Audio', () => {
    expect(
      authoredIframeInputProps({
        logoSrc: 'https://blobs.example/logo.png',
        audioClips: [{ src: 'https://blobs.example/bed.mp3', from: 0, durationInFrames: 450 }],
      }),
    ).toEqual({
      logoSrc: 'https://blobs.example/logo.png',
      audioClips: [],
    })
  })

  it('exposes plates[i].src so agent stills bind', () => {
    const next = authoredIframeInputProps({
      plates: ['https://blobs.example/a.jpg'],
    })
    const plates = next.plates as Array<{ src: string }>
    expect(plates[0]?.src).toBe('https://blobs.example/a.jpg')
  })

  it('is structured-cloneable for iframe postMessage (#1338)', () => {
    const next = authoredIframeInputProps({
      plates: [toAuthoredPlate('https://blobs.example/a.jpg')],
    })
    expect(() => structuredClone(next)).not.toThrow()
    expect((structuredClone(next).plates as Array<{ src: string }>)[0]?.src).toBe(
      'https://blobs.example/a.jpg',
    )
  })
})

describe('hydrateAuthoredInputProps (#1338)', () => {
  it('restores plate toString after a clone so agent Img src still interpolates', () => {
    const cloned = structuredClone(
      authoredIframeInputProps({
        plates: [toAuthoredPlate('https://blobs.example/a.jpg')],
      }),
    )
    const next = hydrateAuthoredInputProps(cloned)
    const plates = next.plates as Array<string & { src: string }>
    expect(plates[0]?.src).toBe('https://blobs.example/a.jpg')
    expect(String(plates[0])).toBe('https://blobs.example/a.jpg')
  })
})

describe('toAuthoredInputProps aliases (#1265)', () => {
  it('binds logoUrl/productUrl and prefers a generator still for productUrl', () => {
    const logoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const stillId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const generatedId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    let project = createEmptyProject({ id: projectId, productId: 'demo' })
    project = {
      ...project,
      compositionId: 'authored',
      brand: {
        productId: 'demo',
        displayName: 'Povotra',
        stillAssetId: stillId,
      },
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-alias-1',
        compileError: null,
      },
    }
    project = attachAsset(project, {
      id: logoId,
      kind: 'image',
      blobKey: 'local/marketing-os/demo/brand-kit/x/logo.png',
      source: 'upload',
      probe: {},
    })
    project = attachAsset(project, {
      id: stillId,
      kind: 'image',
      blobKey: 'local/marketing-os/demo/brand-kit/x/still.jpg',
      source: 'upload',
      probe: {},
    })
    project = attachAsset(project, {
      id: generatedId,
      kind: 'image',
      blobKey: 'local/marketing-os/demo/generated/product.png',
      source: 'generator',
      probe: {},
    })

    const props = toAuthoredInputProps(project, (key) => `https://blobs.example/${key}`)
    expect(props.logoSrc).toBe('https://blobs.example/local/marketing-os/demo/brand-kit/x/logo.png')
    expect(props.logoUrl).toBe(props.logoSrc)
    expect(props.heroSrc).toBe(
      'https://blobs.example/local/marketing-os/demo/generated/product.png',
    )
    expect(props.productUrl).toBe(props.heroSrc)
  })

  it('binds invented Img keys like bgHook onto plates so Remotion Img has a src (#1328)', () => {
    const logoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    let project = createEmptyProject({ id: projectId, productId: 'demo' })
    project = {
      ...project,
      compositionId: 'authored',
      compositionSource: {
        source: 'export default (props) => <Img src={props.bgHook} />',
        motionSeed: 'seed-bghook-1',
        compileError: null,
      },
    }
    project = attachAsset(project, {
      id: logoId,
      kind: 'image',
      blobKey: 'local/marketing-os/demo/brand-kit/x/logo.png',
      source: 'upload',
      probe: {},
    })
    const props = toAuthoredInputProps(project, (key) => `https://blobs.example/${key}`)
    expect((props as { bgHook?: string }).bgHook).toBe(
      'https://blobs.example/local/marketing-os/demo/brand-kit/x/logo.png',
    )
  })

  it('prefers Extract stills as productUrl and never leaks a blob key (#1198)', () => {
    const extractId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const generatedId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    let project = createEmptyProject({ id: projectId, productId: 'demo' })
    project = {
      ...project,
      compositionId: 'authored',
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-extract-1',
        compileError: null,
      },
    }
    project = attachAsset(project, {
      id: extractId,
      kind: 'image',
      blobKey: 'local/marketing-os/demo/extract/still.png',
      source: 'upload',
      probe: { productExtractId: '11111111-1111-4111-8111-111111111111', quality: 'usable' },
    })
    project = attachAsset(project, {
      id: generatedId,
      kind: 'image',
      blobKey: 'local/marketing-os/demo/generated/stock.png',
      source: 'generator',
      probe: {},
    })
    const props = toAuthoredInputProps(project, (key) => `https://blobs.example/sas?sig=1&k=${key}`)
    expect(props.heroSrc).toBe(
      'https://blobs.example/sas?sig=1&k=local/marketing-os/demo/extract/still.png',
    )
    expect(props.productUrl).toBe(props.heroSrc)
    expect(props.heroSrc).not.toBe('local/marketing-os/demo/extract/still.png')
    expect(props.plates.length).toBeGreaterThan(1)
  })

  it('exposes proofStat from brand Catalog/DNA (#1199)', () => {
    let project = createEmptyProject({ id: projectId, productId: 'demo' })
    project = {
      ...project,
      compositionId: 'authored',
      brand: {
        productId: 'demo',
        displayName: 'the private example',
        proofStats: [{ value: 40, unit: 'hours', source: 'catalog', claimId: 'hours-back' }],
      },
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-proof-1',
        compileError: null,
      },
    }
    const props = toAuthoredInputProps(project, (key) => `https://blobs.example/${key}`)
    expect(props.proofStat).toEqual({
      value: 40,
      unit: 'hours',
      source: 'catalog',
      claimId: 'hours-back',
    })
  })
})

describe('authoredAudioClock (#1259)', () => {
  it('maps the global frame onto clip-local seconds and pauses off-range', () => {
    const clips = [
      {
        src: '/api/audio',
        from: 30,
        durationInFrames: 60,
        trimBefore: 10,
      },
    ]
    expect(authoredAudioClock({ clips, fps: 30, frame: 30 })).toEqual([
      { src: '/api/audio', currentTime: 10 / 30, active: true },
    ])
    expect(authoredAudioClock({ clips, fps: 30, frame: 0 })[0]?.active).toBe(false)
    expect(authoredAudioClock({ clips, fps: 30, frame: 90 })[0]?.active).toBe(false)
  })
})
