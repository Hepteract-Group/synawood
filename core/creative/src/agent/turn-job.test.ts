import { describe, expect, it } from 'vitest'
import {
  classifyTurnJob,
  forcedToolsForJob,
  omitToolsForExtractJob,
  isExtractRequest,
  isPictureBindRequest,
  isPictureWriteRequest,
  isRemoveAudioRequest,
  isTrimAudioRequest,
  type TurnJob,
} from './turn-job'

describe('classifyTurnJob', () => {
  it('ranks audio.voice above leftover inspect debt', () => {
    expect(
      classifyTurnJob({
        userMessage: 'Put the existing voiceover on from frame 0. Do not call remove_clip.',
        compositionId: 'authored',
        sourceChars: 9000,
        cutReviewPassed: false,
      }),
    ).toBe('audio.voice')
  })

  it('ranks audio.music when they only ask to change the bed', () => {
    expect(
      classifyTurnJob({
        userMessage: 'Replace the music with a faster bed.',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
      }),
    ).toBe('audio.music')
  })

  it('ranks picture.patch for faster / larger type', () => {
    expect(
      classifyTurnJob({
        userMessage: 'Speed up the motion — it is still too slow. Make the type larger.',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
      }),
    ).toBe('picture.patch')
  })

  it('ranks picture.write when they ask to fix a black / crashing player', () => {
    expect(
      classifyTurnJob({
        userMessage: 'compilation failed. fix it — the player is black',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
      }),
    ).toBe('picture.write')
  })

  it('ranks makeAd for a first kinetic brief on empty authored source', () => {
    expect(
      classifyTurnJob({
        userMessage: 'make a kinetic type ad',
        compositionId: 'authored',
        sourceChars: 0,
        cutReviewPassed: null,
      }),
    ).toBe('makeAd')
  })

  it('ranks picture.write when authored source is empty without a motion brief', () => {
    expect(
      classifyTurnJob({
        userMessage: 'hello',
        compositionId: 'authored',
        sourceChars: 0,
        cutReviewPassed: null,
      }),
    ).toBe('picture.write')
  })

  it('ranks extract.pages above empty-authored write when they paste a product URL (#1365)', () => {
    const message =
      'Extract this product page and keep usable stills in the Extracts bin: https://povotra.com'
    expect(isExtractRequest(message)).toBe(true)
    expect(
      classifyTurnJob({
        userMessage: message,
        compositionId: 'authored',
        sourceChars: 0,
        cutReviewPassed: false,
      }),
    ).toBe('extract.pages')
    expect(
      classifyTurnJob({
        userMessage: message,
        compositionId: 'authored',
        sourceChars: 9000,
        cutReviewPassed: false,
      }),
    ).toBe('extract.pages')
    expect(
      classifyTurnJob({
        userMessage: message,
        compositionId: 'talking-head-60',
        sourceChars: 0,
        cutReviewPassed: null,
      }),
    ).toBe('extract.pages')
    expect(isExtractRequest('Use the usable stills already in the bin')).toBe(false)
    expect(
      classifyTurnJob({
        userMessage: 'Use those stills / plates in the composition. Do not generate new images.',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
      }),
    ).toBe('picture.bind')
  })

  it('ranks picture.bind when they ask to use existing stills', () => {
    expect(
      classifyTurnJob({
        userMessage: 'Use those stills / plates in the composition. Do not generate new images.',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
      }),
    ).toBe('picture.bind')
  })

  it('ranks makeAd for a first kinetic brief with existing source and green inspect', () => {
    expect(
      classifyTurnJob({
        userMessage: 'make a kinetic type ad for grads',
        compositionId: 'authored',
        sourceChars: 2000,
        cutReviewPassed: true,
      }),
    ).toBe('makeAd')
  })

  it('does not treat inspect-fail alone as picture.write when the message is audio', () => {
    expect(isPictureWriteRequest('Add the voice over')).toBe(false)
    expect(isPictureBindRequest('Add the voice over')).toBe(false)
  })

  it('detects remove-audio jobs', () => {
    expect(isRemoveAudioRequest('remove the voiceover')).toBe(true)
    expect(isRemoveAudioRequest('delete the audio')).toBe(true)
    expect(isRemoveAudioRequest('take off the music bed')).toBe(true)
    expect(isRemoveAudioRequest('put the voiceover at 0')).toBe(false)
    expect(
      classifyTurnJob({
        userMessage: 'delete the audio',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
      }),
    ).toBe('audio.remove')
    expect(isTrimAudioRequest('shorten the music from the right')).toBe(true)
    expect(isTrimAudioRequest('add a music bed')).toBe(false)
    expect(
      classifyTurnJob({
        userMessage: 'shorten the music from the right',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
      }),
    ).toBe('audio.trim')
  })
})

describe('forcedToolsForJob', () => {
  const cases: Array<{
    job: TurnJob
    expected: string[]
    opts?: Parameters<typeof forcedToolsForJob>[1]
  }> = [
    {
      job: 'audio.voice',
      expected: ['generate_voiceover', 'duck_music', 'inspect_preview'],
      opts: { forceVoiceover: true, forceMusic: false },
    },
    {
      job: 'audio.voice',
      expected: ['duck_music', 'inspect_preview'],
      opts: { forceVoiceover: false, forceMusic: false },
    },
    {
      job: 'audio.music',
      expected: ['generate_music', 'inspect_preview'],
      opts: { forceMusic: true },
    },
    {
      job: 'picture.patch',
      expected: ['patch_composition', 'inspect_preview'],
    },
    {
      job: 'picture.write',
      expected: ['write_composition', 'inspect_preview'],
    },
    {
      job: 'picture.write',
      expected: ['write_composition', 'generate_music', 'inspect_preview'],
      opts: { forceMusic: true },
    },
    {
      job: 'picture.bind',
      expected: ['patch_composition', 'inspect_preview'],
    },
    {
      job: 'makeAd',
      expected: ['write_composition', 'generate_music', 'inspect_preview'],
      opts: { forceWrite: true, forceMusic: true },
    },
    {
      job: 'makeAd',
      expected: [],
      opts: { forceWrite: false, forceMusic: false },
    },
    {
      job: 'audio.remove',
      expected: ['remove_clip'],
    },
    {
      job: 'audio.trim',
      expected: ['trim_clip'],
    },
    {
      job: 'extract.pages',
      expected: ['extract_product_pages'],
      opts: { forceWrite: true, forceMusic: true },
    },
  ]

  for (const row of cases) {
    it(`queues ${row.expected.join(' → ') || '(empty)'} for ${row.job}`, () => {
      expect(forcedToolsForJob(row.job, row.opts)).toEqual(row.expected)
    })
  }

  it('drops write and music tools on an extract job', () => {
    expect(
      omitToolsForExtractJob({
        extract_product_pages: {},
        write_composition: {},
        generate_music: {},
        get_project_summary: {},
      }),
    ).toEqual({ extract_product_pages: {}, get_project_summary: {} })
  })
})
