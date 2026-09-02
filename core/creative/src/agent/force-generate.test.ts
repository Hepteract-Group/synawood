import { describe, expect, it } from 'vitest'
import { isMakeVideoRequest } from '../critic/inspect-preview'
import {
  isMissingGenerate,
  isMusicRequest,
  MISSING_GENERATE_MESSAGE,
  MISSING_MUSIC_MESSAGE,
  MISSING_VOICEOVER_MESSAGE,
  PLAN_CONFIRMED_GENERATE_MESSAGE,
  shouldForceMusicGenerate,
  shouldForceVoiceoverGenerate,
  shouldForceGenerateFromPlan,
  shouldForceVideoGenerate,
  turnCalledDraftPlan,
  turnCalledGenerateMusic,
  turnCalledGenerateVideo,
} from './force-generate'

describe('shouldForceVideoGenerate (#613)', () => {
  it('forces a tool on make-an-ad when video gen is on and the brief is uncovered', () => {
    expect(
      shouldForceVideoGenerate({
        userMessage: 'produce a 15s ad for okiki alaso',
        videoToolEnabled: true,
        remainingBriefSeconds: 15,
      }),
    ).toBe(true)
  })

  it('does not force generate when video gen is off', () => {
    expect(
      shouldForceVideoGenerate({
        userMessage: 'produce a 15s ad',
        videoToolEnabled: false,
        remainingBriefSeconds: 15,
      }),
    ).toBe(false)
  })

  it('does not force another clip when moving picture already covers the brief', () => {
    expect(
      shouldForceVideoGenerate({
        userMessage: 'produce a 15s ad',
        videoToolEnabled: true,
        remainingBriefSeconds: 0,
      }),
    ).toBe(false)
  })

  it('does not force generate_video_clip on a kinetic type brief (#1196)', () => {
    expect(
      shouldForceVideoGenerate({
        userMessage: 'make a kinetic type ad',
        videoToolEnabled: true,
        remainingBriefSeconds: 30,
      }),
    ).toBe(false)
  })

  it('does not force generate_video_clip on an authored project (#1263)', () => {
    expect(
      shouldForceVideoGenerate({
        userMessage: 'fix it, continue till its done',
        videoToolEnabled: true,
        remainingBriefSeconds: 15,
        compositionId: 'authored',
      }),
    ).toBe(false)
  })

  it('does not force generate on Plan or Ask turns (#1325)', () => {
    expect(
      shouldForceVideoGenerate({
        userMessage: 'produce a 15s ad for okiki alaso',
        videoToolEnabled: true,
        remainingBriefSeconds: 15,
        turnMode: 'plan',
      }),
    ).toBe(false)
    expect(
      shouldForceVideoGenerate({
        userMessage: 'produce a 15s ad for okiki alaso',
        videoToolEnabled: true,
        remainingBriefSeconds: 15,
        turnMode: 'ask',
      }),
    ).toBe(false)
  })

  it('treats any generate_video_clip call as having tried', () => {
    expect(turnCalledGenerateVideo(['get_project_summary'])).toBe(false)
    expect(turnCalledGenerateVideo(['generate_video_clip', 'inspect_preview'])).toBe(true)
    expect(MISSING_GENERATE_MESSAGE).toMatch(/Nothing was generated/)
    expect(MISSING_GENERATE_MESSAGE).toMatch(/did not call tools/)
  })
})

describe('shouldForceMusicGenerate (#1016)', () => {
  it('forces generate_music when they ask for a bed and the track is empty', () => {
    expect(
      shouldForceMusicGenerate({
        userMessage: 'Add background music to the carousel. Make it orchestra music',
        musicToolEnabled: true,
        hasMusicBed: false,
      }),
    ).toBe(true)
  })

  it('matches orchestra music without the word background', () => {
    expect(isMusicRequest('Make it orchestra music')).toBe(true)
    expect(isMusicRequest('trim the last slide')).toBe(false)
    expect(isMusicRequest('remove the orchestra reference')).toBe(false)
  })

  it('does not force another bed when one is already on the audio track', () => {
    expect(
      shouldForceMusicGenerate({
        userMessage: 'add background music',
        musicToolEnabled: true,
        hasMusicBed: true,
      }),
    ).toBe(false)
  })

  it('forces a new bed when they asked to change music that is already there', () => {
    expect(
      shouldForceMusicGenerate({
        userMessage: 'change the pace of the motion and the background music. its too slow.',
        musicToolEnabled: true,
        hasMusicBed: true,
      }),
    ).toBe(true)
  })

  it('does not force when generate_music is off', () => {
    expect(
      shouldForceMusicGenerate({
        userMessage: 'add background music',
        musicToolEnabled: false,
        hasMusicBed: false,
      }),
    ).toBe(false)
  })

  it('does not force music on a Plan turn even when they mentioned a bed (#1325)', () => {
    expect(
      shouldForceMusicGenerate({
        userMessage:
          'Come up with a kinetic type ad plan. It should have background music and speech.',
        musicToolEnabled: true,
        hasMusicBed: false,
        turnMode: 'plan',
      }),
    ).toBe(false)
  })

  it('treats any generate_music call as having tried', () => {
    expect(turnCalledGenerateMusic(['get_project_summary'])).toBe(false)
    expect(turnCalledGenerateMusic(['generate_music'])).toBe(true)
    expect(MISSING_MUSIC_MESSAGE).toMatch(/no music was generated/i)
    expect(MISSING_MUSIC_MESSAGE).toMatch(/did not call tools/)
    expect(MISSING_MUSIC_MESSAGE).not.toMatch(/generate_music/)
    expect(MISSING_MUSIC_MESSAGE).not.toMatch(/Allow paid models/)
  })
})

describe('shouldForceVoiceoverGenerate', () => {
  it('forces generate_voiceover when they ask for VO and none exists', () => {
    expect(
      shouldForceVoiceoverGenerate({
        userMessage: 'Add the voice over. Make it a warm female in her mid-20s.',
        voiceoverToolEnabled: true,
        hasVoiceover: false,
      }),
    ).toBe(true)
  })

  it('does not force when a spoken track is already on the timeline', () => {
    expect(
      shouldForceVoiceoverGenerate({
        userMessage: 'Add the voice over',
        voiceoverToolEnabled: true,
        hasVoiceover: true,
      }),
    ).toBe(false)
  })

  it('does not force VO on Plan', () => {
    expect(
      shouldForceVoiceoverGenerate({
        userMessage: 'Add the voice over',
        voiceoverToolEnabled: true,
        hasVoiceover: false,
        turnMode: 'plan',
      }),
    ).toBe(false)
    expect(MISSING_VOICEOVER_MESSAGE).toMatch(/no voiceover was generated/i)
    expect(MISSING_VOICEOVER_MESSAGE).not.toMatch(/generate_voiceover/)
    expect(MISSING_VOICEOVER_MESSAGE).not.toMatch(/Allow paid models/)
  })
})

describe('shouldForceGenerateFromPlan (#1065)', () => {
  it('forces generate_video_clip when plan is ready + confirmSpend + video enabled', () => {
    expect(
      shouldForceGenerateFromPlan({
        planStatus: 'ready',
        videoToolEnabled: true,
        confirmSpend: true,
      }),
    ).toBe(true)
  })

  it('does not force when plan is draft (not yet confirmed)', () => {
    expect(
      shouldForceGenerateFromPlan({
        planStatus: 'draft',
        videoToolEnabled: true,
        confirmSpend: true,
      }),
    ).toBe(false)
  })

  it('does not force when confirmSpend is false', () => {
    expect(
      shouldForceGenerateFromPlan({
        planStatus: 'ready',
        videoToolEnabled: true,
        confirmSpend: false,
      }),
    ).toBe(false)
  })

  it('does not force when video gen is off', () => {
    expect(
      shouldForceGenerateFromPlan({
        planStatus: 'ready',
        videoToolEnabled: false,
        confirmSpend: true,
      }),
    ).toBe(false)
  })

  it('does not force when no plan exists', () => {
    expect(
      shouldForceGenerateFromPlan({
        planStatus: undefined,
        videoToolEnabled: true,
        confirmSpend: true,
      }),
    ).toBe(false)
  })

  it('PLAN_CONFIRMED_GENERATE_MESSAGE passes isMakeVideoRequest so normalForce also fires', () => {
    expect(isMakeVideoRequest(PLAN_CONFIRMED_GENERATE_MESSAGE)).toBe(true)
  })
})

describe('turnCalledDraftPlan (#1065)', () => {
  it('returns true when draft_generation_plan was called', () => {
    expect(turnCalledDraftPlan(['draft_generation_plan', 'inspect_preview'])).toBe(true)
  })

  it('returns true when update_generation_plan was called', () => {
    expect(turnCalledDraftPlan(['update_generation_plan'])).toBe(true)
  })

  it('returns false when no plan tool was called', () => {
    expect(turnCalledDraftPlan(['generate_video_clip', 'inspect_preview'])).toBe(false)
    expect(turnCalledDraftPlan([])).toBe(false)
  })
})

describe('isMissingGenerate (#1065)', () => {
  it('fires when forced and generate was not called', () => {
    expect(
      isMissingGenerate({
        forceGenerate: true,
        calledGenerate: false,
        planForce: false,
        draftedPlanThisTurn: false,
      }),
    ).toBe(true)
  })

  it('does not fire when generate was called', () => {
    expect(
      isMissingGenerate({
        forceGenerate: true,
        calledGenerate: true,
        planForce: false,
        draftedPlanThisTurn: false,
      }),
    ).toBe(false)
  })

  it('does not fire when not forced', () => {
    expect(
      isMissingGenerate({
        forceGenerate: false,
        calledGenerate: false,
        planForce: false,
        draftedPlanThisTurn: false,
      }),
    ).toBe(false)
  })

  it('suppresses bubble when plan was drafted on a normal force turn', () => {
    expect(
      isMissingGenerate({
        forceGenerate: true,
        calledGenerate: false,
        planForce: false,
        draftedPlanThisTurn: true,
      }),
    ).toBe(false)
  })

  it('still fires when plan was drafted on a planForce (confirmed-plan) turn', () => {
    expect(
      isMissingGenerate({
        forceGenerate: true,
        calledGenerate: false,
        planForce: true,
        draftedPlanThisTurn: true,
      }),
    ).toBe(true)
  })
})
