import { describe, expect, it, beforeEach } from 'vitest'
import {
  dismissedRenderStorageKey,
  isCancelledRenderJob,
  markRenderJobDismissed,
  shouldHydrateLatestRenderJob,
  videoDownloadUrlFromOutputs,
} from './studio-render-job'

const memory = new Map<string, string>()

describe('shouldHydrateLatestRenderJob (#1266)', () => {
  beforeEach(() => {
    memory.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value)
        },
        clear: () => memory.clear(),
      },
    })
  })

  it('skips cancelled jobs so Dismiss survives reload', () => {
    expect(
      shouldHydrateLatestRenderJob({
        id: 'job-cancel',
        status: 'failed',
        errorMessage: 'Export cancelled by operator',
      }),
    ).toBe(false)
  })

  it('hydrates an in-flight encode', () => {
    expect(
      shouldHydrateLatestRenderJob({ id: 'job-run', status: 'rendering', errorMessage: null }),
    ).toBe(true)
  })

  it('skips a failed job after Dismiss', () => {
    const job = { id: 'job-fail', status: 'failed', errorMessage: 'ffmpeg exited 1' }
    expect(shouldHydrateLatestRenderJob(job)).toBe(true)
    markRenderJobDismissed(job.id)
    expect(localStorage.getItem(dismissedRenderStorageKey(job.id))).toBe('1')
    expect(shouldHydrateLatestRenderJob(job)).toBe(false)
  })

  it('still hydrates a completed encode after Dismiss so Download remains (#1271)', () => {
    const job = { id: 'job-done', status: 'completed', errorMessage: null }
    markRenderJobDismissed(job.id)
    expect(shouldHydrateLatestRenderJob(job)).toBe(true)
  })
})

describe('videoDownloadUrlFromOutputs (#1271)', () => {
  it('prefers the video signed URL', () => {
    expect(
      videoDownloadUrlFromOutputs([
        { kind: 'image', signedUrl: 'https://blob/still.png' },
        { kind: 'video', signedUrl: 'https://blob/cut.mp4' },
      ]),
    ).toBe('https://blob/cut.mp4')
  })

  it('falls back to the first signed output when there is no video', () => {
    expect(
      videoDownloadUrlFromOutputs([{ kind: 'image', signedUrl: 'https://blob/still.png' }]),
    ).toBe('https://blob/still.png')
  })

  it('returns null when outputs are missing', () => {
    expect(videoDownloadUrlFromOutputs(undefined)).toBeNull()
    expect(videoDownloadUrlFromOutputs([])).toBeNull()
  })
})

describe('isCancelledRenderJob', () => {
  it('matches cancel copy, not a generic encode fail', () => {
    expect(isCancelledRenderJob({ id: 'a', status: 'failed', errorMessage: 'Cancelled' })).toBe(
      true,
    )
    expect(
      isCancelledRenderJob({ id: 'b', status: 'failed', errorMessage: 'bundle missing' }),
    ).toBe(false)
    expect(isCancelledRenderJob({ id: 'c', status: 'completed', errorMessage: 'cancelled' })).toBe(
      false,
    )
  })
})
