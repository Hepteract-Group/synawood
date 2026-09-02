import { describe, expect, it } from 'vitest'
import {
  boardStatusLabel,
  deriveBoardStatus,
  inferChannelFromDraftName,
  slotShowsThumbnailPicker,
  isoWeekIdFromDate,
  mondayOfIsoWeek,
  parseWeekdayHint,
  parseWeekPlanDays,
  resolvePmColumn,
  shiftIsoWeek,
  titleFromDraft,
  toPmColumn,
  weekOverlapsMonth,
  weekRangeLabel,
} from './content-week-board-shared'

describe('slotShowsThumbnailPicker (#965 / #896)', () => {
  it('shows the picker on a Final with a Studio project, including kanban cards', () => {
    expect(slotShowsThumbnailPicker({ projectId: 'proj-1', hasFinal: true })).toBe(true)
    expect(slotShowsThumbnailPicker({ projectId: null, hasFinal: true })).toBe(false)
    expect(slotShowsThumbnailPicker({ projectId: 'proj-1', hasFinal: false })).toBe(false)
  })
})

describe('inferChannelFromDraftName', () => {
  it('maps linkedin and x draft names', () => {
    expect(inferChannelFromDraftName('01-linkedin-founder-story.md')).toBe('linkedin_founder')
    expect(inferChannelFromDraftName('02-x-privacy-browser.md')).toBe('x_founder')
  })
})

describe('titleFromDraft', () => {
  it('prefers the markdown H1', () => {
    expect(titleFromDraft('01-foo.md', '# Hello world\n\nbody')).toBe('Hello world')
  })
})

describe('deriveBoardStatus + toPmColumn', () => {
  it('maps posted to done', () => {
    const status = deriveBoardStatus({
      projectStatus: 'approved',
      hasFinal: true,
      publishStatus: 'manual_posted',
    })
    expect(status).toBe('posted')
    expect(toPmColumn(status)).toBe('done')
  })

  it('maps draft to planned and studio work to in_progress', () => {
    expect(toPmColumn('draft')).toBe('planned')
    expect(toPmColumn('in_studio')).toBe('in_progress')
  })

  it('resolvePmColumn lets pipeline Done and In progress win over stale Planned', () => {
    expect(resolvePmColumn('posted', 'planned')).toBe('done')
    expect(resolvePmColumn('final_ready', 'planned')).toBe('in_progress')
    expect(resolvePmColumn('draft', 'in_progress')).toBe('in_progress')
    expect(resolvePmColumn('draft', 'done')).toBe('planned')
  })
})

describe('boardStatusLabel', () => {
  it('returns founder-facing labels', () => {
    expect(boardStatusLabel('final_ready')).toBe('Final ready')
  })
})

describe('week plan parsing', () => {
  it('reads weekday hints from README table rows', () => {
    const readme = `
| # | File | Channel | Suggested day |
|---|---|---|---|
| 1 | \`01-linkedin-founder-story.md\` | LinkedIn | Mon/Tue |
| 2 | \`02-x-privacy-browser.md\` | X | Wed |
`
    const map = parseWeekPlanDays(readme)
    expect(map.get('01-linkedin-founder-story.md')).toBe(1)
    expect(map.get('02-x-privacy-browser.md')).toBe(3)
    expect(parseWeekdayHint('Thu/Fri')).toBe(4)
  })

  it('resolves Monday of an ISO week', () => {
    expect(mondayOfIsoWeek('2026-W29').toISOString().slice(0, 10)).toBe('2026-07-13')
  })

  it('computes ISO week from a date', () => {
    expect(isoWeekIdFromDate(new Date('2026-07-15T12:00:00.000Z'))).toBe('2026-W29')
  })

  it('shifts weeks by date, not folder lists', () => {
    expect(shiftIsoWeek('2026-W29', 1)).toBe('2026-W30')
    expect(shiftIsoWeek('2026-W29', -1)).toBe('2026-W28')
  })

  it('labels weeks as a date range for founders', () => {
    expect(weekRangeLabel('2026-W29')).toMatch(/13/)
    expect(weekRangeLabel('2026-W29')).toMatch(/19/)
  })

  it('detects weeks that overlap a month', () => {
    expect(weekOverlapsMonth('2026-W29', '2026-07')).toBe(true)
    expect(weekOverlapsMonth('2026-W29', '2026-08')).toBe(false)
  })
})
