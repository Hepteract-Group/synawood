import { describe, expect, it } from 'vitest'
import { founderCutReviewStatus, humanizeCutReviewForFounder } from './humanize-cut-review'

describe('humanizeCutReviewForFounder', () => {
  it('replaces Remotion RSC dumps with a play-the-clip instruction', () => {
    const dumped =
      "Could not render player frames. Remotion requires React.createContext, but it is 'undefined'. If you are in a React Server Component, turn it into a client component by adding 'use client' at the top of the file. Do not say the video is done."
    expect(humanizeCutReviewForFounder(dumped)).toMatch(/Press play/i)
    expect(humanizeCutReviewForFounder(dumped)).not.toMatch(/createContext/)
    expect(humanizeCutReviewForFounder(dumped)).not.toMatch(/use client/)
    expect(humanizeCutReviewForFounder(dumped)).not.toMatch(/inspect_preview/)
    expect(humanizeCutReviewForFounder(dumped)).not.toMatch(/Do not say/)
  })

  it('replaces cut-review worker jargon with the same play-the-clip instruction', () => {
    const dumped = 'Could not render player frames. Cut-review worker did not return JSON stills.'
    expect(humanizeCutReviewForFounder(dumped)).toMatch(/Press play/i)
    expect(humanizeCutReviewForFounder(dumped)).not.toMatch(/JSON stills/)
    expect(humanizeCutReviewForFounder(dumped)).not.toMatch(/Cut-review worker/)
  })

  it('strips agent-only instructions from otherwise human notes', () => {
    const notes =
      'Cut review failed (coverage). Music plays past the last picture. Fix the timeline and call inspect_preview again. Do not say the video is done.'
    const out = humanizeCutReviewForFounder(notes)
    expect(out).toMatch(/Music plays past/)
    expect(out).not.toMatch(/inspect_preview/)
    expect(out).not.toMatch(/Do not say/)
  })

  it('keeps a short status line for the chat bubble', () => {
    expect(founderCutReviewStatus('inspect_preview did not run.')).toMatch(/not calling this done/i)
    expect(founderCutReviewStatus('inspect_preview did not run.')).not.toMatch(/inspect_preview/)
  })
})
