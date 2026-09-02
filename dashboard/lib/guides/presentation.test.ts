import { describe, expect, it } from 'vitest'
import { GUIDE_CATALOGUE, type GuideDefinition } from './catalogue'
import {
  formatGuideChip,
  guideSettingsAction,
  guideStatusLabel,
  isGuideInProgress,
  listGuidesForSettings,
  pickActiveGuide,
  pickGuideHostView,
  placeGuideCard,
  nextGuideCardPos,
  progressAfterAction,
  shouldShowGuideStart,
  splitGuideEmphasis,
} from './presentation'

const welcome: GuideDefinition = {
  id: 'welcome-v1',
  kind: 'welcome',
  title: 'Welcome to Synawood',
  summary: 'A short look at Home, Studio, and Members. You can skip.',
  releasedAt: '2026-08-23T00:00:00.000Z',
  steps: [
    { id: 'home', title: 'Home', body: 'Home body', route: '/home', spotlight: 'nav-home' },
    {
      id: 'studio',
      title: 'Studio',
      body: 'Studio body',
      route: '/studio',
      spotlight: 'nav-studio',
    },
    {
      id: 'members',
      title: 'Members',
      body: 'Members body',
      route: '/settings/members',
      spotlight: 'members-heading',
    },
  ],
}

const pending = {
  id: 'welcome-v1',
  kind: 'welcome' as const,
  title: 'Welcome to Synawood',
  summary: welcome.summary,
  steps: welcome.steps,
  status: 'pending',
  stepIndex: 0,
}

describe('guide start vs resume', () => {
  it('opens the start dialog only when the tour has not begun', () => {
    expect(shouldShowGuideStart(undefined)).toBe(true)
    expect(shouldShowGuideStart({ guideId: 'welcome-v1', status: 'pending', stepIndex: 0 })).toBe(
      true,
    )
    expect(shouldShowGuideStart({ guideId: 'welcome-v1', status: 'not_seen', stepIndex: 0 })).toBe(
      true,
    )
    expect(
      shouldShowGuideStart({ guideId: 'welcome-v1', status: 'in_progress', stepIndex: 1 }),
    ).toBe(false)
  })

  it('treats in_progress as a resume, not a new start', () => {
    expect(isGuideInProgress('in_progress')).toBe(true)
    expect(isGuideInProgress('dismissed')).toBe(false)
  })
})

describe('pickGuideHostView', () => {
  it('shows the start dialog for a first-run welcome', () => {
    expect(
      pickGuideHostView({
        ready: true,
        blockedByJob: false,
        cardOpen: false,
        showComplete: false,
        completeTitle: '',
        guide: pending,
        autoPromptUsed: false,
      }),
    ).toEqual({ type: 'start', guide: pending })
  })

  it('waits when a generation dialog is open', () => {
    expect(
      pickGuideHostView({
        ready: true,
        blockedByJob: true,
        cardOpen: false,
        showComplete: false,
        completeTitle: '',
        guide: pending,
        autoPromptUsed: false,
      }).type,
    ).toBe('hidden')
  })

  it('resumes with the chip only after reload mid-tour', () => {
    const guide = { ...pending, status: 'in_progress', stepIndex: 1 }
    expect(
      pickGuideHostView({
        ready: true,
        blockedByJob: false,
        cardOpen: false,
        showComplete: false,
        completeTitle: '',
        guide,
        autoPromptUsed: false,
      }),
    ).toEqual({ type: 'step', guide, stepIndex: 1, cardOpen: false })
  })

  it('does not auto-start a second guide in the same login', () => {
    expect(
      pickGuideHostView({
        ready: true,
        blockedByJob: false,
        cardOpen: false,
        showComplete: false,
        completeTitle: '',
        guide: pending,
        autoPromptUsed: true,
      }).type,
    ).toBe('hidden')
  })

  it('shows You are done after the last step', () => {
    expect(
      pickGuideHostView({
        ready: true,
        blockedByJob: false,
        cardOpen: false,
        showComplete: true,
        completeTitle: 'Welcome to Synawood',
        guide: { ...pending, status: 'completed' },
        autoPromptUsed: true,
      }),
    ).toEqual({ type: 'complete', title: 'Welcome to Synawood' })
  })

  it('surfaces a load failure when no guide is available', () => {
    expect(
      pickGuideHostView({
        ready: true,
        blockedByJob: false,
        cardOpen: false,
        showComplete: false,
        completeTitle: '',
        guide: null,
        autoPromptUsed: false,
        error: 'Could not load the guide.',
      }),
    ).toEqual({ type: 'error', message: 'Could not load the guide.' })
  })
})

describe('progressAfterAction', () => {
  it('starts and replays at step 0', () => {
    expect(progressAfterAction({ action: 'start', stepIndex: 2, stepCount: 3 })).toEqual({
      status: 'in_progress',
      stepIndex: 0,
    })
    expect(progressAfterAction({ action: 'replay', stepIndex: 2, stepCount: 3 })).toEqual({
      status: 'in_progress',
      stepIndex: 0,
    })
  })

  it('walks next and back, and completes on the last Next', () => {
    expect(progressAfterAction({ action: 'next', stepIndex: 0, stepCount: 3 })).toEqual({
      status: 'in_progress',
      stepIndex: 1,
    })
    expect(progressAfterAction({ action: 'back', stepIndex: 1, stepCount: 3 })).toEqual({
      status: 'in_progress',
      stepIndex: 0,
    })
    expect(progressAfterAction({ action: 'complete', stepIndex: 2, stepCount: 3 })).toEqual({
      status: 'completed',
      stepIndex: 2,
    })
  })

  it('skip dismisses without resetting the remembered step', () => {
    expect(progressAfterAction({ action: 'skip', stepIndex: 1, stepCount: 3 })).toEqual({
      status: 'dismissed',
      stepIndex: 1,
    })
  })
})

describe('nextGuideCardPos', () => {
  it('keeps the previous object when the card did not move', () => {
    const prev = { top: 88, left: 16, width: 360, centered: false }
    expect(nextGuideCardPos(prev, { top: 88, left: 16, width: 360, centered: false })).toBe(prev)
    expect(nextGuideCardPos(prev, { top: 90, left: 16, width: 360, centered: false })).toEqual({
      top: 90,
      left: 16,
      width: 360,
      centered: false,
    })
  })
})

describe('placeGuideCard', () => {
  const card = { width: 360, height: 220 }
  const viewport = { width: 1280, height: 800 }

  it('centers when the spotlight node is missing', () => {
    const placed = placeGuideCard({ target: null, viewport, card })
    expect(placed.centered).toBe(true)
    expect(placed.left).toBeGreaterThan(400)
  })

  it('sits below a heading when there is room', () => {
    const placed = placeGuideCard({
      target: { top: 80, left: 280, right: 640, bottom: 120 },
      viewport,
      card,
    })
    expect(placed.centered).toBe(false)
    expect(placed.top).toBe(132)
    expect(placed.left).toBe(280)
  })

  it('docks left on Studio so the player stays clear', () => {
    const placed = placeGuideCard({
      target: { top: 200, left: 400, right: 900, bottom: 260 },
      viewport,
      card,
      studioDock: true,
    })
    expect(placed.left).toBe(16)
    expect(placed.top).toBe(88)
  })

  it('goes full width with a 16px inset on a phone', () => {
    const placed = placeGuideCard({
      target: { top: 40, left: 12, right: 300, bottom: 80 },
      viewport: { width: 390, height: 844 },
      card,
    })
    expect(placed.left).toBe(16)
    expect(placed.width).toBe(358)
  })
})

describe('copy helpers', () => {
  it('labels the chip with a readable fraction, not a dot', () => {
    expect(formatGuideChip(1, 3)).toEqual({ label: 'Guide', fraction: '2/3' })
  })

  it('uses Settings words people already know', () => {
    expect(guideStatusLabel('not_seen')).toBe('Not seen')
    expect(guideStatusLabel('in_progress')).toBe('In progress')
    expect(guideStatusLabel('completed')).toBe('Done')
    expect(guideStatusLabel('dismissed')).toBe('Dismissed')
    expect(guideSettingsAction('in_progress')).toBe('Resume')
    expect(guideSettingsAction('dismissed')).toBe('Replay')
    expect(guideSettingsAction('not_seen')).toBe('Start')
  })

  it('bolds a named control once in step copy', () => {
    expect(splitGuideEmphasis('Open **Dashboard** in the sidebar.')).toEqual([
      { text: 'Open ', strong: false },
      { text: 'Dashboard', strong: true },
      { text: ' in the sidebar.', strong: false },
    ])
  })
})

describe('settings list', () => {
  it('fills Not seen when the person has never touched a guide', () => {
    expect(listGuidesForSettings([welcome], [])).toEqual([
      {
        id: 'welcome-v1',
        title: 'Welcome to Synawood',
        summary: welcome.summary,
        kind: 'welcome',
        stepCount: 3,
        status: 'not_seen',
        stepIndex: 0,
      },
    ])
  })
})

describe('pickActiveGuide', () => {
  it('prefers catalogue copy over the session payload', () => {
    const picked = pickActiveGuide([{ ...pending, title: 'stale' }], [welcome])
    expect(picked?.title).toBe('Welcome to Synawood')
    expect(picked?.steps).toHaveLength(3)
  })
})

describe('caption highlights catalogue', () => {
  it('names Captions, Highlights, and Marks without internal labels', () => {
    const guide = GUIDE_CATALOGUE.find((item) => item.id === 'studio-caption-highlights-v1')
    expect(guide?.title).toBe('Caption highlights and marks')
    expect(guide?.steps.map((step) => step.title)).toEqual(['Open Studio', 'Highlights and Marks'])
    const blob = `${guide?.summary ?? ''} ${guide?.steps.map((step) => step.body).join(' ')}`
    expect(blob).not.toMatch(/GIPHY|Giphy|Producer|Quick Design|first-party|SFX|emoji font/i)
  })
})

describe('previous chats catalogue', () => {
  it('points Previous chats at the clock popover, not a slider', () => {
    const guide = GUIDE_CATALOGUE.find((item) => item.id === 'studio-chat-history-popover-v1')
    expect(guide?.title).toBe('Previous chats')
    expect(guide?.steps.map((step) => step.spotlight)).toEqual([
      'nav-studio',
      'studio-chat-history',
    ])
    const blob = `${guide?.summary ?? ''} ${guide?.steps.map((step) => step.body).join(' ')}`
    expect(blob).toMatch(/clock/i)
    expect(blob).not.toMatch(/slider/i)
  })
})

describe('welcome catalogue', () => {
  it('points at Home, Studio, and Members with real spotlight ids', () => {
    const guide = GUIDE_CATALOGUE.find((item) => item.id === 'welcome-v1')
    expect(guide?.steps.map((step) => step.spotlight)).toEqual([
      'nav-home',
      'nav-studio',
      'members-heading',
    ])
    expect(guide?.steps.map((step) => step.route)).toEqual([
      '/home',
      '/studio',
      '/settings/members',
    ])
  })
})
