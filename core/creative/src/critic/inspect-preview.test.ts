import { describe, expect, it } from 'vitest'
import { LEGAL_AUTHORED_FIXTURE, LEGAL_KIT_FIXTURE } from '../authored/fixtures'
import { addClip, attachAsset } from '../project/operations'
import { cutReviewRequired } from '../project/cut-review-state'
import { createEmptyProject, type StudioProject } from '../project/schema'
import { MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { SOURCE_IDENTITY_LOCK } from '../tools/generator-tools'
import {
  applyCutReviewNarration,
  cutReviewFingerprint,
  hasFreshCutReview,
  inspectCut,
  isMakeSlideshowRequest,
  isMakeVideoRequest,
  parseCutReviewRubric,
  sampleCutReviewFrames,
  stampPassedCutReview,
  stripFounderHandoff,
  turnNeedsCutReview,
  collectionLooksConflict,
} from './inspect-preview'

const VIDEO_ID = '11111111-1111-4111-8111-111111111111'
const MUSIC_ID = '55555555-5555-4555-8555-555555555555'
const LOGO_ID = '33333333-3333-4333-8333-333333333333'

const coveredProject = (): StudioProject => {
  const empty = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
    durationFrames: 900,
  })
  const withIntent: StudioProject = {
    ...empty,
    intent: { ...empty.intent, lengthSeconds: 30 },
    brand: {
      productId: 'demo',
      primaryColor: '#0B1F33',
      logoAssetId: LOGO_ID,
    },
  }
  const withVideo = attachAsset(withIntent, {
    id: VIDEO_ID,
    kind: 'video',
    blobKey: 'local/a.mp4',
    source: 'upload',
    probe: { durationFrames: 900 },
  })
  const withLogo = attachAsset(withVideo, {
    id: LOGO_ID,
    kind: 'image',
    blobKey: 'local/logo.png',
    source: 'upload',
    probe: {},
  })
  const withMusic = attachAsset(withLogo, {
    id: MUSIC_ID,
    kind: 'audio',
    blobKey: 'local/bed.mp3',
    source: 'generator',
    probe: { durationFrames: 900, role: 'music_bed' },
  })
  const pictured = addClip(withMusic, {
    assetId: VIDEO_ID,
    trackId: MAIN_VIDEO_TRACK_ID,
    from: 0,
    durationInFrames: 900,
  })
  return addClip(pictured, {
    assetId: MUSIC_ID,
    from: 0,
    durationInFrames: 900,
  })
}

describe('inspectCut (#552)', () => {
  it('detects make-a-video phrasing', () => {
    expect(isMakeVideoRequest('produce a 25s ad for okiki alaso')).toBe(true)
    expect(isMakeVideoRequest('create an ad please')).toBe(true)
    expect(isMakeVideoRequest('finish the ad')).toBe(true)
    expect(isMakeVideoRequest('the video is done')).toBe(true)
    expect(isMakeVideoRequest('what is on the timeline?')).toBe(false)
  })

  it('does not treat analyze_asset as inspect_preview (#591)', () => {
    expect(turnNeedsCutReview('summarise this screen recording', ['analyze_asset'])).toBe(false)
    expect(turnNeedsCutReview('Make a 30s ad', ['analyze_asset'])).toBe(true)
    const project = coveredProject()
    expect(hasFreshCutReview(project)).toBe(false)
    const text = applyCutReviewNarration({
      userMessage: 'Make a 30s ad',
      toolNames: ['analyze_asset'],
      project,
      assistantText: 'The take shows the export button. The video is done.',
    })
    expect(text).toMatch(/not calling this done/i)
    expect(text).not.toMatch(/The video is done/)
    expect(hasFreshCutReview(project)).toBe(false)
    expect(project.cutReview?.passed).not.toBe(true)
  })

  it('requires cut review when the turn assembled picture even without make-video phrasing', () => {
    expect(turnNeedsCutReview('place this on the timeline', ['add_clip'])).toBe(true)
    expect(turnNeedsCutReview('trim the last clip', ['trim_clip'])).toBe(true)
    expect(turnNeedsCutReview('review the player', ['inspect_preview'])).toBe(true)
    expect(turnNeedsCutReview('what is on the timeline?', ['get_project_summary'])).toBe(false)
  })

  it('requires cut review after slideshow assemble tools (#1022)', () => {
    expect(isMakeSlideshowRequest('make a LinkedIn carousel about the launch')).toBe(true)
    expect(isMakeSlideshowRequest('the carousel is done')).toBe(true)
    expect(isMakeSlideshowRequest('what is on slide 2?')).toBe(false)
    expect(turnNeedsCutReview('plan five slides', ['plan_slideshow'])).toBe(true)
    expect(turnNeedsCutReview('generate backgrounds', ['generate_slide_background'])).toBe(true)
  })

  it('does not rewrite a Plan-mode reply as failed cut review (#1325)', () => {
    const uncovered = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    const plan =
      'Generate a new plan based on the above, before i approve and turn on image and video gen'
    expect(turnNeedsCutReview(plan, [], 'plan')).toBe(false)
    expect(
      applyCutReviewNarration({
        userMessage: plan,
        toolNames: [],
        project: uncovered,
        turnMode: 'plan',
        assistantText: 'Here is the revised 60s plan.',
      }),
    ).toBe('Here is the revised 60s plan.')
  })

  it('does not wipe Inspect recommendations when the player was empty (#1325)', () => {
    const uncovered = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    const recs =
      'The player is black. Change 1: kinetic type on MAIN. Change 2: duck the bed under VO.'
    expect(
      applyCutReviewNarration({
        userMessage: 'watch the player and tell me what to change',
        toolNames: ['inspect_preview'],
        project: uncovered,
        turnMode: 'inspect',
        assistantText: recs,
      }),
    ).toBe(recs)
  })

  it('rewrites success narration until inspect_preview passes', () => {
    const uncovered = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    expect(
      applyCutReviewNarration({
        userMessage: 'Make a video',
        toolNames: ['add_clip'],
        project: uncovered,
        assistantText: 'The video is done.',
      }),
    ).toMatch(/not calling this done/i)
    expect(
      applyCutReviewNarration({
        userMessage: 'Make a video',
        toolNames: ['add_clip'],
        project: uncovered,
        assistantText: 'The video is done.',
      }),
    ).not.toMatch(/cannot say the video is done/i)
    const reviewed = stampPassedCutReview(coveredProject(), [0, 449, 899])
    expect(
      applyCutReviewNarration({
        userMessage: 'Make a video',
        toolNames: ['inspect_preview'],
        project: reviewed,
        assistantText: 'The video is done.',
      }),
    ).toBe('The video is done.')
  })

  it('keeps a useful model reply and appends a short review status', () => {
    const uncovered = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    const text = applyCutReviewNarration({
      userMessage: 'Make a video',
      toolNames: ['generate_video_clip'],
      project: uncovered,
      inspectError:
        "Could not render player frames. Remotion requires React.createContext, but it is 'undefined'.",
      assistantText: 'The 25s clip is on the main track with music under it.',
    })
    expect(text).toMatch(/25s clip is on the main track/)
    expect(text).toMatch(/Press play/)
    expect(text).not.toMatch(/createContext/)
    expect(text).not.toMatch(/cannot say the video is done/)
  })

  it('strips asking the founder what to do after a failing inspect (#601)', () => {
    const uncovered = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    const text = applyCutReviewNarration({
      userMessage: 'Make a 25s TikTok',
      toolNames: ['inspect_preview'],
      project: uncovered,
      inspectError: 'The picture track is 50s but the brief asked for 25s.',
      assistantText:
        'Cut review failed picture completeness. What should we do next? I am not calling this done yet.',
    })
    expect(text).not.toMatch(/what should we do next/i)
    expect(text).toMatch(/not calling this done/i)
  })

  it('strips variant handoffs and keeps markdown bullets (#607)', () => {
    const uncovered = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    expect(stripFounderHandoff('What would you like me to do?')).toBe('')
    expect(stripFounderHandoff('Shall I continue?')).toBe('')
    const kept = stripFounderHandoff(
      '- **Hook** is in\n- **End card** is late\n\nWhat would you like me to do?',
    )
    expect(kept).toMatch(/- \*\*Hook\*\* is in/)
    expect(kept).toMatch(/- \*\*End card\*\* is late/)
    expect(kept).not.toMatch(/would you like/i)
    const text = applyCutReviewNarration({
      userMessage: 'Make a 25s TikTok',
      toolNames: ['inspect_preview'],
      project: uncovered,
      inspectError: 'The picture track is 50s but the brief asked for 25s.',
      assistantText: 'What would you like me to do next?',
    })
    expect(text).not.toMatch(/\?/)
    expect(text).toMatch(/not calling this done/i)
    const leftover = applyCutReviewNarration({
      userMessage: 'Make a 25s TikTok',
      toolNames: ['inspect_preview'],
      project: uncovered,
      inspectError: 'The picture track is 50s but the brief asked for 25s.',
      assistantText: 'Looks thin. Want me to try another angle?',
    })
    expect(leftover).toMatch(/Looks thin/)
    expect(leftover).not.toMatch(/\?/)
    expect(leftover).toMatch(/not calling this done/i)
    const unknownQuestion = applyCutReviewNarration({
      userMessage: 'Make a 25s TikTok',
      toolNames: ['inspect_preview'],
      project: uncovered,
      inspectError: 'The picture track is 50s but the brief asked for 25s.',
      assistantText: 'The motion is weak. Does this look better?',
    })
    expect(unknownQuestion).toMatch(/The motion is weak/)
    expect(unknownQuestion).not.toMatch(/\?/)
    expect(unknownQuestion).toMatch(/not calling this done/i)
    const blankThenQuestion = applyCutReviewNarration({
      userMessage: 'Make a 25s TikTok',
      toolNames: ['inspect_preview'],
      project: uncovered,
      inspectError: 'The picture track is 50s but the brief asked for 25s.',
      assistantText: 'The motion is weak.\n\nDoes this look better?',
    })
    expect(blankThenQuestion).toMatch(/^The motion is weak\./)
    expect(blankThenQuestion).not.toMatch(/\?/)
    expect(blankThenQuestion).not.toMatch(/\n{3,}/)
    expect(blankThenQuestion).toMatch(/not calling this done/i)
    const reviewed = stampPassedCutReview(coveredProject(), [0, 449, 899])
    expect(
      applyCutReviewNarration({
        userMessage: 'Make a video',
        toolNames: ['inspect_preview'],
        project: reviewed,
        assistantText: 'The video is done. What should we do next?',
      }),
    ).toBe('The video is done.')
  })

  it('blocks narration if the timeline changed after a passing inspect', () => {
    const reviewed = stampPassedCutReview(coveredProject(), [0, 449, 899])
    const edited = {
      ...reviewed,
      clips: reviewed.clips.map((clip) => ({
        ...clip,
        durationInFrames: clip.durationInFrames - 30,
      })),
    }
    expect(
      applyCutReviewNarration({
        userMessage: 'Make a video',
        toolNames: ['inspect_preview', 'trim_clip'],
        project: edited,
        assistantText: 'The video is done.',
      }),
    ).toMatch(/timeline changed after the last review/i)
  })

  it('fails cheap completeness before calling vision', async () => {
    const empty = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    let rendered = 0
    const result = await inspectCut(empty, {
      modelProfileId: 'ci-stub',
      renderFrames: async () => {
        rendered += 1
        return []
      },
    })
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('completeness')
    expect(rendered).toBe(0)
  })

  it('samples start, middle, and end frames of a 30s cut', () => {
    const project = coveredProject()
    const frames = sampleCutReviewFrames(project)
    expect(frames[0]).toBe(0)
    expect(frames).toContain(project.durationFrames - 1)
    expect(frames.length).toBeGreaterThanOrEqual(3)
  })

  it('samples overlay-active frames so inspect sees hook and end card (#597)', () => {
    const project = {
      ...coveredProject(),
      overlays: [
        {
          id: 'overlay_hook',
          kind: 'hook_title' as const,
          text: 'Hook',
          from: 0,
          durationInFrames: 90,
        },
        {
          id: 'overlay_end',
          kind: 'end_card' as const,
          text: 'Shop',
          from: 810,
          durationInFrames: 90,
        },
      ],
    }
    const frames = sampleCutReviewFrames(project)
    expect(frames).toContain(0)
    expect(frames).toContain(89)
    expect(frames).toContain(810)
    expect(frames).toContain(899)
  })

  it('invalidates a passing review when overlays move (#597)', () => {
    const project = coveredProject()
    const stamped = stampPassedCutReview(project, [0, 449, 899], 'ok')
    const withCard = {
      ...stamped,
      overlays: [
        {
          id: 'overlay_end',
          kind: 'end_card' as const,
          text: 'Shop',
          from: 600,
          durationInFrames: 90,
        },
      ],
    }
    expect(hasFreshCutReview(withCard)).toBe(false)
  })

  it('passes ci-stub vision when completeness already passed', async () => {
    const result = await inspectCut(coveredProject(), { modelProfileId: 'ci-stub' })
    expect(result.ok).toBe(true)
    expect(result.phase).toBe('vision')
  })

  it('fails tof talking-head with Buy now end card (#1220)', async () => {
    const project: StudioProject = {
      ...coveredProject(),
      intent: {
        ...coveredProject().intent,
        funnelStage: 'tof',
        goal: 'awareness',
        cta: 'Learn more',
      },
      overlays: [
        {
          id: 'overlay_end',
          kind: 'end_card',
          text: 'Buy now',
          from: 900,
          durationInFrames: 90,
        },
      ],
    }
    const result = await inspectCut(project, { modelProfileId: 'ci-stub' })
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('vision')
    if (result.phase === 'vision') {
      expect(result.rubric.brief).toBe('fail')
      expect(result.error).toMatch(/top-of-funnel|Buy now/i)
    }
  })

  it('fails bof talking-head with no end CTA (#1220)', async () => {
    const project: StudioProject = {
      ...coveredProject(),
      intent: {
        ...coveredProject().intent,
        funnelStage: 'bof',
        goal: 'signup',
        cta: 'Start a trial',
      },
    }
    const result = await inspectCut(project, { modelProfileId: 'ci-stub' })
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('vision')
    if (result.phase === 'vision') {
      expect(result.rubric.brief).toBe('fail')
      expect(result.error).toMatch(/last-seconds CTA/i)
    }
  })

  it('fails a live profile when no player frames were rendered', async () => {
    const result = await inspectCut(coveredProject(), { modelProfileId: 'founder-edit' })
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('vision')
    expect(result.error ?? '').toMatch(/player frames/i)
  })

  it('passes a live profile only after it looked at rendered frames', async () => {
    const result = await inspectCut(coveredProject(), {
      modelProfileId: 'founder-edit',
      renderFrames: async (frames) =>
        frames.map((frame) => ({ frame, bytes: Buffer.from('png-bytes') })),
      critique: async () => ({
        coverage: 'pass',
        motion: 'pass',
        size: 'pass',
        audio: 'pass',
        brand: 'pass',
        brief: 'pass',
        notes: 'Looked at frames.',
      }),
    })
    expect(result.ok).toBe(true)
    expect(result.phase).toBe('vision')
  })

  it('stamps a fingerprint so later timeline edits invalidate the review', () => {
    const project = coveredProject()
    const stamped = stampPassedCutReview(project, [0, 449, 899], 'ok')
    expect(hasFreshCutReview(stamped)).toBe(true)
    expect(stamped.cutReview?.fingerprint).toBe(cutReviewFingerprint(project))
    const edited = {
      ...stamped,
      clips: stamped.clips.map((clip) => ({
        ...clip,
        durationInFrames: clip.durationInFrames - 30,
      })),
    }
    expect(hasFreshCutReview(edited)).toBe(false)
  })

  it('dirties cut review when a treatment is applied', () => {
    const project = coveredProject()
    const stamped = stampPassedCutReview(project, [0, 449, 899], 'ok')
    expect(hasFreshCutReview(stamped)).toBe(true)
    const treated = {
      ...stamped,
      clips: stamped.clips.map((clip) => ({
        ...clip,
        treatments: [{ id: 'flash', intensity: 1 }],
      })),
    }
    expect(cutReviewFingerprint(treated)).not.toBe(cutReviewFingerprint(stamped))
    expect(hasFreshCutReview(treated)).toBe(false)
  })

  it('fails when the vision rubric flags size', async () => {
    const result = await inspectCut(coveredProject(), {
      modelProfileId: 'ci-stub',
      critique: async () => ({
        coverage: 'pass',
        motion: 'pass',
        size: 'fail',
        audio: 'pass',
        brand: 'pass',
        brief: 'pass',
        notes: 'Tiny corner graphic.',
      }),
    })
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('vision')
    if (result.phase === 'vision') expect(result.rubric.size).toBe('fail')
  })

  it('forwards critic skills into the vision judge', async () => {
    let excerpt = ''
    await inspectCut(coveredProject(), {
      modelProfileId: 'ci-stub',
      skillsExcerpt: 'Never leave the main picture black.',
      critique: async (input) => {
        excerpt = input.skillsExcerpt ?? ''
        return {
          coverage: 'pass',
          motion: 'pass',
          size: 'pass',
          audio: 'pass',
          brand: 'pass',
          brief: 'pass',
          notes: 'ok',
        }
      },
    })
    expect(excerpt).toMatch(/Never leave the main picture black/)
  })

  it('parses a structured critic JSON blob', () => {
    const rubric = parseCutReviewRubric(
      '{"coverage":"pass","motion":"fail","size":"pass","audio":"pass","brand":"pass","brief":"pass","notes":"Stills only"}',
    )
    expect(rubric.motion).toBe('fail')
    expect(rubric.notes).toBe('Stills only')
  })

  it('fails inspect when extra still refs are locked to one photo (#612)', async () => {
    const empty = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    const withIntent: StudioProject = {
      ...empty,
      intent: { ...empty.intent, lengthSeconds: 30 },
      brand: { productId: 'demo', primaryColor: '#0B1F33', logoAssetId: LOGO_ID },
    }
    const withLogo = attachAsset(withIntent, {
      id: LOGO_ID,
      kind: 'image',
      blobKey: 'local/logo.png',
      source: 'upload',
      probe: {},
    })
    const withAsset = attachAsset(withLogo, {
      id: VIDEO_ID,
      kind: 'video',
      blobKey: 'local/gen.mp4',
      source: 'generator',
      probe: {
        durationFrames: 900,
        sourceImageAssetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        referenceImageAssetIds: ['44444444-4444-4444-8444-444444444444'],
        prompt: `${SOURCE_IDENTITY_LOCK} Use [Image 1], [Image 2]`,
      },
    })
    const withMusic = attachAsset(withAsset, {
      id: MUSIC_ID,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 900, role: 'music_bed' },
    })
    const onMain = addClip(
      addClip(withMusic, {
        assetId: VIDEO_ID,
        trackId: MAIN_VIDEO_TRACK_ID,
        from: 0,
        durationInFrames: 900,
      }),
      {
        assetId: MUSIC_ID,
        from: 0,
        durationInFrames: 900,
      },
    )
    expect(collectionLooksConflict(onMain)).toMatch(/second tagged look/)
    const result = await inspectCut(onMain, { modelProfileId: 'ci-stub' })
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('completeness')
    expect(result.error).toMatch(/second tagged look/)
  })
})

describe('inspectCut authored (#1197)', () => {
  const authoredProject = (source: string) => {
    const base = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      compositionId: 'authored',
    })
    return {
      ...base,
      brand: {
        productId: 'demo',
        displayName: 'the private example',
        logoAssetId: LOGO_ID,
        defaultCta: 'Try the private example',
      },
      intent: {
        ...base.intent,
        keywords: ['40'],
        audience: { persona: 'UK bid writers' },
        primaryMessage: 'Get 40 hours back on tender prep',
      },
      compositionSource: {
        source,
        motionSeed: 'seed-inspect-1',
        compileError: null,
        artDirection: { dialect: 'editorial' as const, layout: 'full-bleed-type' as const },
      },
    }
  }

  it('requires cut review for authored even with an empty picture window', () => {
    const empty = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      compositionId: 'authored',
    })
    expect(cutReviewRequired(empty)).toBe(true)
    expect(turnNeedsCutReview('30s kinetic type on the pricing claim', [])).toBe(true)
    expect(turnNeedsCutReview('harder spring', ['write_composition'])).toBe(true)
  })

  it('samples authored duration, not the talking-head picture window', () => {
    const project = { ...authoredProject(LEGAL_AUTHORED_FIXTURE), durationFrames: 90 }
    expect(sampleCutReviewFrames(project)).toEqual([0, 44, 89])
  })

  it('samples inside Sequence coverage, not the empty canvas tail (#1265)', () => {
    const source = `import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion'
export default function Ad() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={60}><div>{frame}</div></Sequence>
      <Sequence from={60} durationInFrames={120}><div>{interpolate(frame, [0, 8], [0, 1])}</div></Sequence>
      <Sequence from={180} durationInFrames={150}><div>device</div></Sequence>
      <Sequence from={330} durationInFrames={120}><div>cta</div></Sequence>
    </AbsoluteFill>
  )
}
`
    const project = { ...authoredProject(source), durationFrames: 497 }
    expect(sampleCutReviewFrames(project)).toEqual([0, 224, 449])
  })

  it('fails inspect on a static fade poster', async () => {
    const source = `import { AbsoluteFill, useCurrentFrame } from 'remotion'

export default function FadePoster() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: 0.4 }}>
      <div>Still juggling PDFs? {frame}</div>
    </AbsoluteFill>
  )
}
`
    const result = await inspectCut(authoredProject(source), { modelProfileId: 'ci-stub' })
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('vision')
    if (result.phase === 'vision') {
      expect(result.rubric.motion).toBe('fail')
      expect(result.error).toMatch(/static poster/)
    }
  })

  it('passes inspect on a kit dialect fixture', async () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      '<KineticType dialect="editorial" text={\'40 hours back\'} />',
    )
    const result = await inspectCut(authoredProject(source), { modelProfileId: 'ci-stub' })
    expect(result.ok).toBe(true)
    expect(result.phase).toBe('vision')
  })

  it('does not fail authored kinetic type as a still slideshow (#1328)', async () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      '<KineticType dialect="editorial" text={\'40 hours back\'} />',
    )
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const result = await inspectCut(authoredProject(source), {
      modelProfileId: 'ci-stub',
      renderFrames: async (frames) => frames.map((frame) => ({ frame, bytes: png })),
      critique: async () => ({
        coverage: 'pass',
        motion: 'fail',
        size: 'pass',
        audio: 'pass',
        brand: 'pass',
        brief: 'pass',
        notes:
          'The motion is a fail because the visuals appear static or a slow zoom without actual video motion, indicating a still slideshow rather than a video.',
      }),
    })
    expect(result.ok).toBe(true)
    if (result.phase === 'vision') expect(result.rubric.motion).toBe('pass')
  })

  it('maps everyone-audience constitution fail onto rubric brief (#1243)', async () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      '<KineticType dialect="editorial" text={\'40 hours back\'} />',
    )
    const project = authoredProject(source)
    const result = await inspectCut(
      {
        ...project,
        intent: { ...project.intent, audience: { persona: 'everyone' } },
      },
      { modelProfileId: 'ci-stub' },
    )
    expect(result.ok).toBe(false)
    expect(result.phase).toBe('vision')
    if (result.phase === 'vision') {
      expect(result.rubric.brief).toBe('fail')
      expect(result.rubric.motion).toBe('pass')
      expect(result.error).toMatch(/audience|everyone/i)
    }
  })

  it('rewrites done narration until authored inspect passes', () => {
    const project = authoredProject(LEGAL_AUTHORED_FIXTURE)
    const text = applyCutReviewNarration({
      userMessage: 'make a kinetic type ad',
      toolNames: ['write_composition'],
      project,
      assistantText: 'The ad is done.',
    })
    expect(text).toMatch(/not calling this done/i)
    expect(hasFreshCutReview(project)).toBe(false)
  })

  it('does not stamp cut review from analyze_asset on authored (ADR-0053)', () => {
    const project = authoredProject(LEGAL_AUTHORED_FIXTURE)
    expect(turnNeedsCutReview('summarise this screen recording', ['analyze_asset'])).toBe(false)
    const text = applyCutReviewNarration({
      userMessage: 'summarise this screen recording',
      toolNames: ['analyze_asset'],
      project,
      assistantText: 'The take shows the export button.',
    })
    expect(text).not.toMatch(/not calling this done/i)
    expect(hasFreshCutReview(project)).toBe(false)
    expect(project.cutReview?.passed).not.toBe(true)
  })
})
