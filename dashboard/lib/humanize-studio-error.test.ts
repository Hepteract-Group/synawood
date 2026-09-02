import { describe, expect, it } from 'vitest'
import {
  humanizeStudioError,
  isAlreadyInPlaceStudioError,
  presentStudioError,
} from './humanize-studio-error'

describe('humanizeStudioError', () => {
  it('hides Remotion cut-review internals', () => {
    expect(
      humanizeStudioError(
        "Could not render player frames. Remotion requires React.createContext, but it is 'undefined'.",
      ),
    ).toMatch(/Press play/i)
  })

  it('softens truncated multipart upload errors', () => {
    expect(humanizeStudioError('Failed to parse body as FormData.')).toMatch(/too large|cut off/i)
  })

  it('softens no-op mutations', () => {
    expect(
      humanizeStudioError(
        'Tool had nothing new to apply — the project already matches those inputs.',
      ),
    ).toMatch(/already on the timeline/i)
    expect(
      humanizeStudioError('Mutation made no change to the project — re-check inputs.'),
    ).toMatch(/already on the timeline/i)
  })

  it('passes through unknown copy after stripping tool prefixes', () => {
    const msg = 'Upload failed: network reset'
    expect(humanizeStudioError(msg)).toBe(msg)
  })

  it('presents a calm banner for already-applied suggestions', () => {
    const presented = presentStudioError('Tool had nothing new to apply')
    expect(presented.title).toBe('Already in place')
    expect(presented.tone).toBe('info')
    expect(presented.body).toMatch(/already on the timeline/i)
  })

  it('detects already-in-place errors for soft dismiss', () => {
    expect(
      isAlreadyInPlaceStudioError(
        'Tool had nothing new to apply — the project already matches those inputs.',
      ),
    ).toBe(true)
    expect(isAlreadyInPlaceStudioError('Unknown clip')).toBe(false)
  })

  it('does not throw when humanizing non-string errors', () => {
    expect(humanizeStudioError(undefined)).toMatch(/something went wrong/i)
    expect(presentStudioError(undefined).title).toBe('Something went wrong')
    expect(humanizeStudioError("Cannot read properties of undefined (reading 'trim')")).toMatch(
      /could not be applied/i,
    )
  })

  it('explains truncated Azure Blob connection strings (#479)', () => {
    expect(
      humanizeStudioError(
        'AZURE_STORAGE_CONNECTION_STRING must include AccountName and AccountKey (parsed keys: DefaultEndpointsProtocol).',
      ),
    ).toMatch(/Unset AZURE_STORAGE_CONNECTION_STRING/i)
  })

  it('explains bare Unauthorized from middleware', () => {
    expect(humanizeStudioError('Unauthorized')).toMatch(/sign in again/i)
  })

  it('explains Seedance duration rejects without vendor request ids', () => {
    expect(
      humanizeStudioError(
        'The parameter duration specified in the request is not valid for model dreamina-seedance-2-0 in t2v Request id: abc',
      ),
    ).toMatch(/4–15 seconds/i)
    expect(
      humanizeStudioError(
        'The parameter duration specified in the request is not valid for model dreamina-seedance-2-0 in t2v Request id: abc',
      ),
    ).not.toMatch(/Request id/i)
  })

  it('explains leftover confirmSpend tool-arg errors (#1328)', () => {
    expect(
      humanizeStudioError("The 'confirmSpend' parameter is required when estimate > £0."),
    ).toMatch(/already allowed/i)
    expect(
      humanizeStudioError('Estimated £0.40 needs confirmSpend=true before live video.'),
    ).toMatch(/does not need a confirmSpend argument/i)
    expect(
      humanizeStudioError(
        '{"code":"unrecognized_keys","keys":["confirmSpend"],"message":"Unrecognized key: \\"confirmSpend\\""}',
      ),
    ).toMatch(/already allowed/i)
  })

  it('explains missing Playwright browsers so Extracts stills can land (#1365)', () => {
    expect(
      humanizeStudioError(
        "No stills landed in the Extracts bin. browserType.launch: Executable doesn't exist at /Users/wale/Library/Caches/ms-playwright/chromium_headless_shell-1169/chrome-mac/headless_shell",
      ),
    ).toMatch(/npx playwright install chromium/i)
    expect(
      humanizeStudioError(
        'No stills landed in the Extracts bin. Playwright Chromium is not installed. In the repo root run: npx playwright install chromium',
      ),
    ).toMatch(/npx playwright install chromium/i)
  })

  it('adds a Buy credits action for empty-wallet gate copy (#1251)', () => {
    const presented = presentStudioError(
      'This job is about £0.05. Your organisation has £0.00 left. Buy credits to run it.',
    )
    expect(presented.title).toBe('Not enough credits')
    expect(presented.action).toEqual({ href: '/settings/billing', label: 'Buy credits' })
  })
})
