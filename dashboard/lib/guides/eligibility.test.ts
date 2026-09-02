import { describe, expect, it } from 'vitest'
import type { GuideDefinition } from './catalogue'
import { readGuideForceId, selectEligibleGuides } from './eligibility'

const welcome = (id: string, releasedAt: string): GuideDefinition => ({
  id,
  kind: 'welcome',
  title: id,
  summary: 'Welcome',
  releasedAt,
  steps: [],
})

const feature = (
  id: string,
  releasedAt: string,
  extra?: Partial<GuideDefinition>,
): GuideDefinition => ({
  id,
  kind: 'feature',
  title: id,
  summary: 'Feature',
  releasedAt,
  steps: [],
  ...extra,
})

const now = new Date('2026-08-23T12:00:00.000Z')

describe('selectEligibleGuides', () => {
  it('offers welcome after the person has a team, and skips it once dismissed', () => {
    const catalogue = [welcome('welcome-v1', '2026-08-01T00:00:00.000Z')]
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: null,
        userCreatedAt: '2026-08-20T00:00:00.000Z',
        memberships: [{ role: 'owner' }],
        progress: [],
        catalogue,
      }).map((guide) => guide.id),
    ).toEqual(['welcome-v1'])
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: null,
        userCreatedAt: '2026-08-20T00:00:00.000Z',
        memberships: [],
        progress: [],
        catalogue,
      }),
    ).toEqual([])
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: '2026-08-22T00:00:00.000Z',
        userCreatedAt: '2026-08-20T00:00:00.000Z',
        memberships: [{ role: 'owner' }],
        progress: [{ guideId: 'welcome-v1', status: 'dismissed' }],
        catalogue,
      }),
    ).toEqual([])
  })

  it('offers a feature tour on the next login after it ships, not to people who joined later', () => {
    const catalogue = [feature('titles-v1', '2026-08-22T00:00:00.000Z')]
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: '2026-08-21T00:00:00.000Z',
        userCreatedAt: '2026-07-01T00:00:00.000Z',
        memberships: [{ role: 'editor' }],
        progress: [],
        catalogue,
      }).map((guide) => guide.id),
    ).toEqual(['titles-v1'])
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: '2026-08-22T12:00:00.000Z',
        userCreatedAt: '2026-07-01T00:00:00.000Z',
        memberships: [{ role: 'editor' }],
        progress: [],
        catalogue,
      }),
    ).toEqual([])
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: null,
        userCreatedAt: '2026-08-23T00:00:00.000Z',
        memberships: [{ role: 'editor' }],
        progress: [],
        catalogue,
      }),
    ).toEqual([])
  })

  it('prompts one Guide per login: welcome first, else the oldest pending feature', () => {
    const catalogue = [
      welcome('welcome-v1', '2026-08-01T00:00:00.000Z'),
      feature('older-v1', '2026-08-20T00:00:00.000Z'),
      feature('newer-v1', '2026-08-21T00:00:00.000Z'),
    ]
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: '2026-08-19T00:00:00.000Z',
        userCreatedAt: '2026-07-01T00:00:00.000Z',
        memberships: [{ role: 'editor' }],
        progress: [],
        catalogue,
      }).map((guide) => guide.id),
    ).toEqual(['welcome-v1'])
    expect(
      selectEligibleGuides({
        now,
        previousLoginAt: '2026-08-19T00:00:00.000Z',
        userCreatedAt: '2026-07-01T00:00:00.000Z',
        memberships: [{ role: 'editor' }],
        progress: [{ guideId: 'welcome-v1', status: 'dismissed' }],
        catalogue,
      }).map((guide) => guide.id),
    ).toEqual(['older-v1'])
  })

  it('welcome-v2 is not offered to users who already dismissed or completed welcome-v1', () => {
    const catalogue = [
      welcome('welcome-v1', '2026-08-23T00:00:00.000Z'),
      { ...welcome('welcome-v2', '2026-08-27T00:00:00.000Z'), supersedesId: 'welcome-v1' },
    ]
    const base = {
      now: new Date('2026-08-27T12:00:00.000Z'),
      previousLoginAt: null,
      userCreatedAt: '2026-08-27T00:00:00.000Z',
      memberships: [{ role: 'owner' }],
      catalogue,
    }
    // Brand-new user with no progress sees v2 (highest releasedAt welcome)
    expect(selectEligibleGuides({ ...base, progress: [] }).map((guide) => guide.id)).toEqual([
      'welcome-v2',
    ])
    // User who dismissed v1 does not get resurrected via v2
    expect(
      selectEligibleGuides({
        ...base,
        progress: [{ guideId: 'welcome-v1', status: 'dismissed' }],
      }),
    ).toEqual([])
    // User who completed v1 does not get prompted for v2
    expect(
      selectEligibleGuides({
        ...base,
        progress: [{ guideId: 'welcome-v1', status: 'completed' }],
      }),
    ).toEqual([])
  })

  it('force still shows a guide that eligibility would hide, unless it is already skipped', () => {
    const catalogue = [welcome('welcome-v1', '2026-08-01T00:00:00.000Z')]
    const base = {
      now,
      previousLoginAt: null,
      userCreatedAt: '2026-08-20T00:00:00.000Z',
      memberships: [] as { role: string }[],
      catalogue,
      forceId: 'welcome-v1',
    }
    expect(selectEligibleGuides({ ...base, progress: [] }).map((guide) => guide.id)).toEqual([
      'welcome-v1',
    ])
    expect(
      selectEligibleGuides({
        ...base,
        progress: [{ guideId: 'welcome-v1', status: 'dismissed' }],
      }),
    ).toEqual([])
    expect(
      selectEligibleGuides({
        ...base,
        progress: [{ guideId: 'welcome-v1', status: 'completed' }],
      }),
    ).toEqual([])
  })
})

describe('readGuideForceId', () => {
  it('uses GUIDE_FORCE_ID in local and preview, and ignores it in production', () => {
    expect(readGuideForceId({ GUIDE_FORCE_ID: 'welcome-v1' })).toBe('welcome-v1')
    expect(readGuideForceId({ GUIDE_FORCE_ID: 'welcome-v1', VERCEL_ENV: 'preview' })).toBe(
      'welcome-v1',
    )
    expect(
      readGuideForceId({ GUIDE_FORCE_ID: 'welcome-v1', VERCEL_ENV: 'production' }),
    ).toBeUndefined()
    expect(readGuideForceId({ GUIDE_FORCE_ID: '  ', VERCEL_ENV: 'development' })).toBeUndefined()
  })
})
