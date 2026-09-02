import { randomUUID } from 'node:crypto'
import { addClip, attachAsset, createEmptyProject } from '../../project/index'
import type { StudioProject } from '../../project/schema'
import { videoTrackHasGaps } from '../../project/operations'
import type { RunTurnResult } from '../types'
import { LEGAL_KIT_FIXTURE } from '../../authored/fixtures'

export type EvalFixture = {
  id: string
  title: string
  userMessage: string
  /** When set, reasoner is a text-only mock (no tools). */
  narrateOnly?: boolean
  /** Scripted tool sequence for the eval harness mock. */
  scripted?: 'analyze-only'
  setupProject: () => StudioProject
  assert: (result: RunTurnResult) => void
}

const projectId = '22222222-2222-4222-8222-222222222222'
const assetA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const assetB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const withTwoGappedClips = (): StudioProject => {
  let project = createEmptyProject({ id: projectId, productId: 'demo' })
  project = attachAsset(project, {
    id: assetA,
    kind: 'video',
    blobKey: 'local/a.mp4',
    source: 'upload',
    probe: { durationFrames: 90 },
  })
  project = attachAsset(project, {
    id: assetB,
    kind: 'video',
    blobKey: 'local/b.mp4',
    source: 'upload',
    probe: { durationFrames: 90 },
  })
  project = addClip(project, { assetId: assetA, from: 0, durationInFrames: 90 })
  project = addClip(project, { assetId: assetB, from: 180, durationInFrames: 90 })
  return project
}

const emptyProject = (): StudioProject => createEmptyProject({ id: projectId, productId: 'demo' })

/** Brand already set (Brand Studio / prior import) — generate_* requires project.brand. */
const projectWithBrand = (): StudioProject => {
  const base = emptyProject()
  return {
    ...base,
    brand: {
      productId: 'demo',
      displayName: 'the private example',
      primaryColor: '#1F6B4A',
      accentColor: '#C45C26',
      defaultCta: 'Try the private example free',
      mood: 'calm',
      stillAssetIds: [],
    },
  }
}

export const EVAL_FIXTURES: EvalFixture[] = [
  {
    id: 'pack-closes-gap',
    title: 'pack the timeline abuts gapped clips',
    userMessage: 'pack the timeline',
    setupProject: withTwoGappedClips,
    assert: (result) => {
      if (videoTrackHasGaps(result.project)) {
        throw new Error('Expected no gaps after pack_clips')
      }
      const froms = result.project.clips.map((c) => c.from).sort((a, b) => a - b)
      if (froms[0] !== 0 || froms[1] !== 90) {
        throw new Error(`Expected froms [0,90], got ${JSON.stringify(froms)}`)
      }
      if (!result.toolTrace.some((t) => t.toolName === 'pack_clips' && t.outcome.ok)) {
        throw new Error('Expected successful pack_clips in toolTrace')
      }
    },
  },
  {
    id: 'narrate-without-act',
    title: 'narrate-without-act is grounded (no fake success)',
    userMessage: 'generate an end screen image please',
    narrateOnly: true,
    setupProject: emptyProject,
    assert: (result) => {
      if (result.toolTrace.length > 0) {
        throw new Error('Expected zero tool calls for narrate-only fixture')
      }
      if (!/no tools ran/i.test(result.assistantText)) {
        throw new Error(`Expected grounded no-tools text, got: ${result.assistantText}`)
      }
    },
  },
  {
    id: 'generate-image-stub',
    title: 'generate_image runs on ci-stub profile for image prompt',
    userMessage: 'Generate an image of a calm PDF workspace',
    setupProject: projectWithBrand,
    assert: (result) => {
      const gen = result.toolTrace.find((t) => t.toolName === 'generate_image')
      if (!gen?.outcome.ok) {
        throw new Error(`Expected generate_image ok, got ${JSON.stringify(gen?.outcome)}`)
      }
      if (!result.project.assets.some((a) => a.source === 'generator' && a.kind === 'image')) {
        throw new Error('Expected a generator image asset on the project')
      }
    },
  },
  {
    id: 'library-first-proof-closeups',
    title: 'cover proof with close-ups retrieves Moments before generate',
    userMessage: 'cover proof with close-ups',
    setupProject: () => {
      let project = emptyProject()
      project = attachAsset(project, {
        id: assetA,
        kind: 'video',
        blobKey: 'local/proof.mp4',
        source: 'upload',
        probe: { durationFrames: 300 },
      })
      return project
    },
    assert: (result) => {
      const names = result.toolTrace.map((t) => t.toolName)
      const findIdx = names.indexOf('find_moments')
      const generateIdx = names.indexOf('generate_video_clip')
      if (findIdx === -1) {
        throw new Error(`Expected find_moments before generate, got ${JSON.stringify(names)}`)
      }
      if (generateIdx !== -1 && generateIdx < findIdx) {
        throw new Error(
          `generate_video_clip must not run before find_moments when library shots exist, got ${JSON.stringify(names)}`,
        )
      }
      if (
        !names.includes('assemble_broll') &&
        !names.includes('place_shot') &&
        !names.includes('commit_broll_plan')
      ) {
        throw new Error(
          `Expected assemble_broll or place_shot after Moments, got ${JSON.stringify(names)}`,
        )
      }
      const find = result.toolTrace.find((t) => t.toolName === 'find_moments')
      const input = find?.input as { sceneRole?: string } | undefined
      if (input?.sceneRole !== 'proof') {
        throw new Error(`Expected find_moments sceneRole proof, got ${JSON.stringify(find?.input)}`)
      }
      if (/\bFinal\b/.test(result.assistantText)) {
        throw new Error(`Must not claim a generated clip is Final: ${result.assistantText}`)
      }
    },
  },
  {
    id: 'analyze-without-inspect',
    title: 'analyze_asset without inspect_preview fails the cut',
    userMessage: 'Make a 30s ad',
    scripted: 'analyze-only',
    setupProject: () => {
      let project = projectWithBrand()
      project = attachAsset(project, {
        id: assetA,
        kind: 'video',
        blobKey: 'local/talk.mp4',
        source: 'upload',
        probe: { durationFrames: 900 },
      })
      project = addClip(project, { assetId: assetA, from: 0, durationInFrames: 900 })
      return project
    },
    assert: (result) => {
      const names = result.toolTrace.map((entry) => entry.toolName)
      if (!names.includes('analyze_asset')) {
        throw new Error(`Expected analyze_asset, got ${JSON.stringify(names)}`)
      }
      if (names.includes('inspect_preview')) {
        throw new Error('inspect_preview must not run on this fixture')
      }
      if (!/not calling this done/i.test(result.assistantText)) {
        throw new Error(`Expected cut-review fail copy, got: ${result.assistantText}`)
      }
      if (/\bFinal\b/.test(result.assistantText)) {
        throw new Error(`Must not claim Final: ${result.assistantText}`)
      }
      if (result.project.cutReview?.passed) {
        throw new Error('analyze_asset must not stamp cut review passed')
      }
    },
  },
  {
    id: 'kinetic-type-write',
    title: 'kinetic type brief writes composition, not talking-head clips',
    userMessage: '30s kinetic type on the pricing claim',
    setupProject: projectWithBrand,
    assert: (result) => {
      const names = result.toolTrace.map((entry) => entry.toolName)
      if (!names.includes('write_composition')) {
        throw new Error(`Expected write_composition, got ${JSON.stringify(names)}`)
      }
      if (names.includes('add_clip') && !names.includes('write_composition')) {
        throw new Error('add_clip must not be the only picture on a kinetic brief')
      }
      if (result.project.compositionId !== 'authored') {
        throw new Error(`Expected authored, got ${result.project.compositionId}`)
      }
      if (names.includes('generate_video_clip')) {
        throw new Error('Must not fall back to generate_video_clip on a kinetic brief')
      }
    },
  },
  {
    id: 'kinetic-library-first',
    title: 'kinetic brief with library stills finds moments before generate_image',
    userMessage: '30s kinetic type on the pricing claim',
    setupProject: () => {
      let project = projectWithBrand()
      project = attachAsset(project, {
        id: assetA,
        kind: 'image',
        blobKey: 'local/marketing-os/demo/library/ui.png',
        source: 'upload',
        probe: {},
      })
      return project
    },
    assert: (result) => {
      const names = result.toolTrace.map((entry) => entry.toolName)
      const findIdx = names.indexOf('find_moments')
      const genIdx = names.indexOf('generate_image')
      if (findIdx < 0) {
        throw new Error(`Expected find_moments before generate_image, got ${JSON.stringify(names)}`)
      }
      if (genIdx >= 0 && genIdx < findIdx) {
        throw new Error(`generate_image ran before find_moments: ${JSON.stringify(names)}`)
      }
    },
  },
  {
    id: 'kinetic-compile-patch',
    title: 'compile error patches TSX instead of switching to talking-head',
    userMessage: '30s kinetic type on the pricing claim — compile failed, patch it',
    setupProject: () => {
      const base = projectWithBrand()
      return {
        ...base,
        compositionId: 'authored' as const,
        compositionSource: {
          source: `import fs from 'node:fs'\n${LEGAL_KIT_FIXTURE}`,
          motionSeed: 'seed-eval-1',
          compileError: 'Line 1: Blocked import "node:fs"',
        },
      }
    },
    assert: (result) => {
      const names = result.toolTrace.map((entry) => entry.toolName)
      if (!names.includes('patch_composition')) {
        throw new Error(`Expected patch_composition, got ${JSON.stringify(names)}`)
      }
      if (result.project.compositionId === 'talking-head-60') {
        throw new Error('Must not switch to talking-head-60 after a compile error')
      }
      if (!result.project.compositionSource?.source.includes('KineticType')) {
        throw new Error('Patch must keep kit source')
      }
      if (result.project.compositionSource?.source.includes('node:fs')) {
        throw new Error('Patch must drop the blocked import')
      }
    },
  },
  {
    id: 'voiceover-outranks-inspect-debt',
    title: 'place existing VO at frame 0 without rewriting the composition (#1329)',
    userMessage: 'Put the existing voiceover on from frame 0. Do not call remove_clip.',
    setupProject: () => {
      const musicId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      const voId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      let project = projectWithBrand()
      project = {
        ...project,
        compositionId: 'authored' as const,
        durationFrames: 1800,
        intent: { ...project.intent, lengthSeconds: 60 },
        cutReview: {
          passed: false,
          at: new Date().toISOString(),
          fingerprint: 'x',
          frames: [],
          notes: 'black',
          rubric: {
            coverage: 'fail',
            motion: 'pass',
            size: 'pass',
            audio: 'fail',
            brand: 'pass',
            brief: 'pass',
          },
        },
        compositionSource: {
          source: LEGAL_KIT_FIXTURE,
          motionSeed: 'seed-vo-1',
          compileError: null,
        },
      }
      project = attachAsset(project, {
        id: musicId,
        kind: 'audio',
        blobKey: 'local/bed.mp3',
        source: 'generator',
        probe: { role: 'music_bed', durationFrames: 1800 },
      })
      project = attachAsset(project, {
        id: voId,
        kind: 'audio',
        blobKey: 'local/vo.mp3',
        source: 'generator',
        probe: { text: 'Most grads do not fail interviews.', durationFrames: 535 },
      })
      project = addClip(project, {
        assetId: musicId,
        trackId: 'track_audio',
        from: 0,
        durationInFrames: 1800,
      })
      project = addClip(project, {
        assetId: voId,
        trackId: 'track_audio',
        from: 1800,
        durationInFrames: 535,
      })
      return project
    },
    assert: (result) => {
      const names = result.toolTrace.map((entry) => entry.toolName)
      if (names[0] === 'write_composition') {
        throw new Error('write_composition must not steal step 0 on an audio.voice job')
      }
      if (names.includes('write_composition')) {
        throw new Error(`Must not rewrite TSX for place-VO: ${JSON.stringify(names)}`)
      }
      if (names.includes('generate_image')) {
        throw new Error('Must not mint stills on a place-VO turn')
      }
      if (!names.includes('generate_voiceover')) {
        throw new Error(`Expected generate_voiceover, got ${JSON.stringify(names)}`)
      }
      const speech = result.project.clips.find((clip) => {
        const asset = result.project.assets.find((item) => item.id === clip.assetId)
        return asset?.probe?.text
      })
      if (!speech || speech.from !== 0 || speech.trackId !== 'track_sfx') {
        throw new Error(
          `Expected speech on track_sfx from 0, got ${JSON.stringify(speech ?? null)}`,
        )
      }
      if (result.project.durationFrames > 1900) {
        throw new Error(`Duration grew from stacked audio: ${result.project.durationFrames}`)
      }
    },
  },
]

export const newEvalRunId = (): string => randomUUID()
