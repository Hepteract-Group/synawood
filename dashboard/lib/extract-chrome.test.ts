import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appliedBriefIdFromProjectJson,
  shouldOpenAdGeneratorWizard,
  shouldRestoreExtractChrome,
  shouldFocusExtractsBin,
  searchWithoutWizard,
} from './extract-chrome'

const read = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8')

describe('appliedBriefIdFromProjectJson', () => {
  it('reads the applied brief id from project_json', () => {
    expect(appliedBriefIdFromProjectJson({ brief: { id: 'brief-1' } })).toBe('brief-1')
  })

  it('returns null when no brief is on the project', () => {
    expect(appliedBriefIdFromProjectJson({})).toBeNull()
    expect(appliedBriefIdFromProjectJson(null)).toBeNull()
  })
})

describe('shouldRestoreExtractChrome', () => {
  it('restores in-progress and failed extract jobs', () => {
    expect(shouldRestoreExtractChrome({ status: 'queued', applied: true })).toBe(true)
    expect(shouldRestoreExtractChrome({ status: 'generating', applied: false })).toBe(true)
    expect(shouldRestoreExtractChrome({ status: 'failed', applied: true })).toBe(true)
  })

  it('hides Brief ready after the brief is applied', () => {
    expect(shouldRestoreExtractChrome({ status: 'ready', applied: true })).toBe(false)
  })

  it('hides Brief ready after dismiss even if not applied', () => {
    expect(shouldRestoreExtractChrome({ status: 'ready', applied: false, dismissed: true })).toBe(
      false,
    )
  })

  it('hides a failed extract after dismiss', () => {
    expect(shouldRestoreExtractChrome({ status: 'failed', applied: false, dismissed: true })).toBe(
      false,
    )
  })

  it('still restores in-progress extract after dismiss of an older job', () => {
    expect(
      shouldRestoreExtractChrome({ status: 'generating', applied: false, dismissed: true }),
    ).toBe(true)
  })

  it('shows Brief ready until apply', () => {
    expect(shouldRestoreExtractChrome({ status: 'ready', applied: false })).toBe(true)
  })
})

describe('shouldOpenAdGeneratorWizard', () => {
  it('opens from the create-from-URL query only when no brief is applied yet', () => {
    expect(shouldOpenAdGeneratorWizard({ wizardQuery: 'ad-generator', briefApplied: false })).toBe(
      true,
    )
  })

  it('does not reopen after the brief is already on the project', () => {
    expect(shouldOpenAdGeneratorWizard({ wizardQuery: 'ad-generator', briefApplied: true })).toBe(
      false,
    )
  })

  it('stays closed without the wizard query', () => {
    expect(shouldOpenAdGeneratorWizard({ wizardQuery: null, briefApplied: false })).toBe(false)
  })
})

describe('searchWithoutWizard', () => {
  it('drops only the wizard query and keeps other params', () => {
    expect(searchWithoutWizard('?wizard=ad-generator&panel=edits')).toBe('?panel=edits')
  })

  it('returns an empty search when wizard was the only param', () => {
    expect(searchWithoutWizard('wizard=ad-generator')).toBe('')
  })

  it('drops extractUrl and extractSource with the wizard query (#1326)', () => {
    expect(searchWithoutWizard('?wizard=ad-generator&extractUrl=https://x.test&panel=edits')).toBe(
      '?panel=edits',
    )
  })
})

describe('shouldFocusExtractsBin', () => {
  it('opens Extracts while a product_pages extract is queued, generating, or failed', () => {
    expect(
      shouldFocusExtractsBin([{ role: 'extract', status: 'queued', extractKind: 'product_pages' }]),
    ).toBe(true)
    expect(
      shouldFocusExtractsBin([
        { role: 'extract', status: 'generating', extractKind: 'product_pages' },
      ]),
    ).toBe(true)
    expect(
      shouldFocusExtractsBin([{ role: 'extract', status: 'failed', extractKind: 'product_pages' }]),
    ).toBe(true)
  })

  it('leaves Library alone for Ad Generator extract and idle ready jobs', () => {
    expect(
      shouldFocusExtractsBin([{ role: 'extract', status: 'queued', extractKind: 'brief_extract' }]),
    ).toBe(false)
    expect(shouldFocusExtractsBin([{ role: 'extract', status: 'queued' }])).toBe(false)
    expect(
      shouldFocusExtractsBin([{ role: 'extract', status: 'ready', extractKind: 'product_pages' }]),
    ).toBe(false)
    expect(shouldFocusExtractsBin([{ role: 'music', status: 'queued' }])).toBe(false)
    expect(shouldFocusExtractsBin([])).toBe(false)
  })

  it('wires Media bin to Extracts while extract is in flight', () => {
    const bin = read('components/studio/AssetBin.tsx')
    const workspace = read('components/studio/StudioWorkspace.tsx')
    const jobsRoute = read('app/api/studio/projects/[projectId]/generation-jobs/route.ts')
    expect(bin).toMatch(/extractInFlight/)
    expect(bin).toMatch(/setMediaMode\('extracts'\)/)
    expect(workspace).toMatch(/shouldFocusExtractsBin\(generationJobs\)/)
    expect(jobsRoute).toMatch(/extractKind/)
  })
})

describe('chat extract spawn (#1365)', () => {
  it('spawns the local extract worker from onTool, not after runTurn', () => {
    const route = read('app/api/studio/chat/route.ts')
    expect(route).toMatch(
      /onTool:[\s\S]{0,500}extract_product_pages[\s\S]{0,500}spawnLocalExtractWorker/,
    )
    expect(route).not.toMatch(/for \(const entry of result\.toolTrace\)/)
    const spawn = read('lib/spawn-local-extract.ts')
    expect(spawn).toMatch(/automations\/creative-extract\.ts/)
    expect(spawn).not.toMatch(/npm run extract:local/)
  })
})
