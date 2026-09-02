import { describe, expect, it } from 'vitest'
import {
  CHANNEL_UNBOUND_TITLE,
  POSTIZ_DOWN_BODY,
  POSTIZ_DOWN_TITLE,
  POSTIZ_NOT_CONFIGURED_BODY,
  POSTIZ_NOT_CONFIGURED_TITLE,
  classifyScheduleError,
  emptyScheduleCopy,
  postedNowBanner,
  scheduleFailureUi,
  scheduleWhenLabel,
  scheduledBanner,
  schedulingBanner,
} from './schedule-publish-copy'
import { slotCanSchedule, type WeekBoardSlot } from './content-week-board-shared'

const slot = (overrides: Partial<WeekBoardSlot> = {}): WeekBoardSlot => ({
  slotId: 'slot_1',
  weekId: '2026-W35',
  channel: 'linkedin_founder',
  title: 'Cut',
  description: null,
  draftPath: null,
  projectId: 'proj_1',
  projectStatus: 'approved',
  boardStatus: 'final_ready',
  pmColumn: 'in_progress',
  priority: null,
  dueDate: null,
  plannedDate: null,
  plannedWeekday: null,
  labels: [],
  assignee: null,
  hasFinal: true,
  finalAssetId: 'fa_1',
  trialExport: false,
  thumbnailAssetId: null,
  postedLinks: [],
  publishes: [],
  studioHref: '/studio/proj_1',
  commentCount: 0,
  ...overrides,
})

describe('schedule publish copy (#808)', () => {
  it('names the channel on in-flight and scheduled banners', () => {
    expect(schedulingBanner('linkedin_founder')).toBe('Scheduling to LinkedIn…')
    expect(scheduledBanner('x_founder', '2026-08-27T10:00:00.000Z')).toBe(
      'Scheduled to X for 2026-08-27 10:00 UTC. Waiting for the live link.',
    )
    expect(postedNowBanner('tiktok_organic')).toBe(
      'Posted to TikTok. The live link will appear on this card.',
    )
  })

  it('uses the documented empty copy when Postiz is not configured', () => {
    expect(POSTIZ_NOT_CONFIGURED_TITLE).toBe('Postiz is not configured')
    expect(POSTIZ_NOT_CONFIGURED_BODY).toMatch(/Open Settings/)
    expect(POSTIZ_NOT_CONFIGURED_BODY).toMatch(/paste/)
  })

  it('uses the documented unmapped-channel sentence', () => {
    expect(emptyScheduleCopy('unbound').title).toBe(CHANNEL_UNBOUND_TITLE)
    expect(CHANNEL_UNBOUND_TITLE).toBe('This channel has no Postiz account')
    expect(classifyScheduleError(500, 'This channel is not bound to a Postiz account.')).toBe(
      'unbound',
    )
    expect(classifyScheduleError(503, 'Postiz is not configured')).toBe('not_configured')
  })

  it('uses a specific Postiz-down sentence, not a blank or generic empty', () => {
    expect(POSTIZ_DOWN_TITLE).toBe('Postiz is down')
    expect(POSTIZ_DOWN_BODY).toMatch(/paste the live URL/i)
    expect(emptyScheduleCopy('down')).toEqual({
      title: 'Postiz is down',
      body: POSTIZ_DOWN_BODY,
      settingsHref: null,
    })
    expect(emptyScheduleCopy('unbound').settingsHref).toBe('/settings/channels')
    expect(classifyScheduleError(500, 'Postiz create-post failed (502).')).toBe('down')
    expect(classifyScheduleError(500, 'Postiz multipart upload failed (503).')).toBe('down')
    expect(classifyScheduleError(500, 'Postiz create-post failed (401).')).toBe('other')
    expect(classifyScheduleError(0, 'Failed to fetch')).toBe('down')
    expect(classifyScheduleError(0, 'Load failed')).toBe('down')
    expect(classifyScheduleError(503, 'Postiz is not configured')).toBe('not_configured')
    expect(scheduleFailureUi(500, 'Postiz create-post failed (502).')).toEqual({
      phase: 'empty',
      emptyKind: 'down',
      error: null,
    })
    expect(scheduleFailureUi(500, 'Postiz create-post failed (401).')).toEqual({
      phase: 'error',
      error: 'Postiz create-post failed (401).',
    })
    expect(scheduleFailureUi(0, 'Failed to fetch')).toEqual({
      phase: 'empty',
      emptyKind: 'down',
      error: null,
    })
  })

  it('formats a schedule time in UTC', () => {
    expect(scheduleWhenLabel('2026-08-27T10:00:00.000Z')).toBe('2026-08-27 10:00 UTC')
  })
})

describe('slotCanSchedule (#808)', () => {
  it('allows Schedule on a Final with no live post yet', () => {
    expect(slotCanSchedule(slot())).toBe(true)
  })

  it('hides Schedule when the Final is already scheduled or posted', () => {
    expect(
      slotCanSchedule(
        slot({
          publishes: [
            {
              id: 'pr_1',
              channel: 'linkedin_founder',
              status: 'scheduled',
              scheduledAt: '2026-08-27T10:00:00.000Z',
              externalUrl: null,
            },
          ],
        }),
      ),
    ).toBe(false)
    expect(
      slotCanSchedule(
        slot({
          hasFinal: true,
          publishes: [
            {
              id: 'pr_2',
              channel: 'linkedin_founder',
              status: 'posted',
              scheduledAt: null,
              externalUrl: 'https://x.com/demo/status/1',
            },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('does not offer Schedule before Approve', () => {
    expect(slotCanSchedule(slot({ hasFinal: false, finalAssetId: null }))).toBe(false)
  })
})
