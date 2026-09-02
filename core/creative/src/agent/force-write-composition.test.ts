import { describe, expect, it } from 'vitest'
import {
  MISSING_WRITE_COMPOSITION_MESSAGE,
  shouldForcePatchComposition,
  shouldForceWriteComposition,
  turnCalledWriteComposition,
  forcedToolForStep,
} from './force-write-composition'

describe('shouldForceWriteComposition (#1329)', () => {
  it('does not force write when inspect failed but the job is audio.voice', () => {
    expect(
      shouldForceWriteComposition({
        turnMode: 'execute',
        compositionId: 'authored',
        sourceChars: 9070,
        cutReviewPassed: false,
        userMessage: 'Put the existing voiceover on from frame 0.',
      }),
    ).toBe(false)
  })

  it('does not force write when the job is extract.pages even if authored source is empty (#1365)', () => {
    expect(
      shouldForceWriteComposition({
        turnMode: 'execute',
        compositionId: 'authored',
        sourceChars: 0,
        cutReviewPassed: false,
        userMessage:
          'Extract this product page and keep usable stills in the Extracts bin: https://povotra.com',
      }),
    ).toBe(false)
  })

  it('forces extract_product_pages first — never write or music (#1365)', () => {
    expect(
      forcedToolForStep({
        stepNumber: 0,
        forceWrite: true,
        forceMusic: true,
        forcedFirstTool: 'write_composition',
        job: 'extract.pages',
      }),
    ).toEqual({ type: 'tool', toolName: 'extract_product_pages' })
    expect(
      forcedToolForStep({
        stepNumber: 1,
        forceWrite: true,
        forceMusic: true,
        forcedFirstTool: 'write_composition',
        job: 'extract.pages',
      }),
    ).toBe('auto')
  })

  it('forces write when Execute + authored + empty source', () => {
    expect(
      shouldForceWriteComposition({
        turnMode: 'execute',
        compositionId: 'authored',
        sourceChars: 0,
        cutReviewPassed: null,
        userMessage: 'make a kinetic type ad',
      }),
    ).toBe(true)
  })

  it('forces write when they ask to fix a black / crashed player', () => {
    expect(
      shouldForceWriteComposition({
        turnMode: 'execute',
        compositionId: 'authored',
        sourceChars: 4000,
        cutReviewPassed: false,
        userMessage: 'compilation failed. fix it — the player is black',
      }),
    ).toBe(true)
  })

  it('does not force write on Plan', () => {
    expect(
      shouldForceWriteComposition({
        turnMode: 'plan',
        compositionId: 'authored',
        sourceChars: 0,
        cutReviewPassed: false,
        userMessage: 'make a kinetic type ad',
      }),
    ).toBe(false)
  })

  it('does not force write when inspect already passed and message is empty of write intent', () => {
    expect(
      shouldForceWriteComposition({
        turnMode: 'execute',
        compositionId: 'authored',
        sourceChars: 2000,
        cutReviewPassed: true,
        userMessage: 'looks good',
      }),
    ).toBe(false)
  })

  it('does not force write on footage projects', () => {
    expect(
      shouldForceWriteComposition({
        turnMode: 'execute',
        compositionId: 'talking-head-60',
        sourceChars: 0,
        cutReviewPassed: false,
        userMessage: 'make an ad',
      }),
    ).toBe(false)
  })

  it('treats write or patch as having written', () => {
    expect(turnCalledWriteComposition(['write_composition'])).toBe(true)
    expect(turnCalledWriteComposition(['patch_composition'])).toBe(true)
    expect(turnCalledWriteComposition(['inspect_preview'])).toBe(false)
    expect(MISSING_WRITE_COMPOSITION_MESSAGE).toMatch(/Nothing was written to the Player/)
  })

  it('forces voice → duck → inspect for an audio.voice job, never write first', () => {
    expect(
      forcedToolForStep({
        stepNumber: 0,
        forceWrite: false,
        forceMusic: false,
        forceVoiceover: true,
        forcedFirstTool: 'generate_voiceover',
        job: 'audio.voice',
      }),
    ).toEqual({ type: 'tool', toolName: 'generate_voiceover' })
    expect(
      forcedToolForStep({
        stepNumber: 1,
        forceWrite: false,
        forceMusic: false,
        forceVoiceover: true,
        forcedFirstTool: 'generate_voiceover',
        job: 'audio.voice',
      }),
    ).toEqual({ type: 'tool', toolName: 'duck_music' })
    expect(
      forcedToolForStep({
        stepNumber: 0,
        forceWrite: true,
        forceMusic: false,
        forceVoiceover: true,
        forcedFirstTool: 'write_composition',
        job: 'audio.voice',
      }),
    ).toEqual({ type: 'tool', toolName: 'generate_voiceover' })
  })

  it('forces write → music → inspect for picture.write when a bed is missing', () => {
    expect(
      forcedToolForStep({
        stepNumber: 0,
        forceWrite: true,
        forceMusic: true,
        forcedFirstTool: 'write_composition',
        job: 'picture.write',
      }),
    ).toEqual({ type: 'tool', toolName: 'write_composition' })
    expect(
      forcedToolForStep({
        stepNumber: 1,
        forceWrite: true,
        forceMusic: true,
        forcedFirstTool: 'write_composition',
        job: 'picture.write',
      }),
    ).toEqual({ type: 'tool', toolName: 'generate_music' })
    expect(
      forcedToolForStep({
        stepNumber: 2,
        forceWrite: true,
        forceMusic: true,
        forcedFirstTool: 'write_composition',
        job: 'picture.write',
      }),
    ).toEqual({ type: 'tool', toolName: 'inspect_preview' })
  })

  it('forces patch when Execute + authored + they asked for faster type', () => {
    expect(
      shouldForcePatchComposition({
        turnMode: 'execute',
        compositionId: 'authored',
        sourceChars: 4000,
        userMessage: 'the pace is too slow. Make the text size larger.',
      }),
    ).toBe(true)
    expect(
      shouldForcePatchComposition({
        turnMode: 'plan',
        compositionId: 'authored',
        sourceChars: 4000,
        userMessage: 'the pace is too slow',
      }),
    ).toBe(false)
  })
})
