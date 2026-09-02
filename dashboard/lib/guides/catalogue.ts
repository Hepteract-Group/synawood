import { PRODUCT_NAME } from '../product-name'

export type GuideKind = 'welcome' | 'feature'

export type GuideStep = {
  id: string
  title: string
  body: string
  route?: string
  spotlight?: string
}

export type GuideDefinition = {
  id: string
  kind: GuideKind
  title: string
  summary: string
  releasedAt: string
  includeNewUsers?: boolean
  audience?: 'all' | 'owner' | 'editor'
  /**
   * If set, this guide is skipped for any user who already has terminal
   * progress on the named id (dismissed or completed welcome-v1 users do
   * not get auto-prompted for welcome-v2).
   */
  supersedesId?: string
  steps: GuideStep[]
}

/** First-run tour. Feature tours are added in the PR that ships the surface. */
export const GUIDE_CATALOGUE: GuideDefinition[] = [
  {
    id: 'welcome-v1',
    kind: 'welcome',
    title: `Welcome to ${PRODUCT_NAME}`,
    summary: 'A short look at Home, Studio, and Members. You can skip.',
    releasedAt: '2026-08-23T00:00:00.000Z',
    audience: 'all',
    steps: [
      {
        id: 'home',
        title: 'Home',
        body: 'This is your operating view: work for the week, spend, and where to go next. Open **Dashboard** in the sidebar.',
        route: '/home',
        spotlight: 'nav-home',
      },
      {
        id: 'studio',
        title: 'Studio',
        body: 'Studio is where you cut ads. Chat, timeline, and export live here. Open **Studio** in the sidebar.',
        route: '/studio',
        spotlight: 'nav-studio',
      },
      {
        id: 'members',
        title: 'Members',
        body: 'Invite teammates and set what they can do. You can add more people any time. This page is **Members**.',
        route: '/settings/members',
        spotlight: 'members-heading',
      },
    ],
  },
  {
    id: 'welcome-v2',
    kind: 'welcome',
    title: `Welcome to ${PRODUCT_NAME}`,
    summary:
      'Five steps: Home, Studio, Brand, Members, and Approve. Skip any time — Approve stays open.',
    releasedAt: '2026-08-27T00:00:00.000Z',
    audience: 'all',
    supersedesId: 'welcome-v1',
    steps: [
      {
        id: 'home',
        title: 'Home',
        body: 'Your operating view: work for the week, spend, and where to go next. Open **Home** in the sidebar.',
        route: '/home',
        spotlight: 'nav-home',
      },
      {
        id: 'studio',
        title: 'Studio',
        body: 'Upload a talking-head take, then chat or edit the timeline. **Approve** ships it. Open **Studio** in the sidebar.',
        route: '/studio',
        spotlight: 'nav-studio',
      },
      {
        id: 'brand',
        title: 'Brand Studio',
        body: 'Your logo burns into every export. Open the **Brand** button in Studio, then **Brand Studio**, and upload a logo.',
        route: '/studio',
        spotlight: 'logo-upload',
      },
      {
        id: 'members',
        title: 'Members',
        body: 'Invite teammates and set roles. Seat limit comes from your plan. This page is **Members**.',
        route: '/settings/members',
        spotlight: 'members-heading',
      },
      {
        id: 'approve',
        title: 'Approve',
        body: 'When the cut is ready, click **Approve**. That is the success moment — the Final lands in your work pipeline. Skip this step if the cut is not ready yet.',
        route: '/studio',
        spotlight: 'approve',
      },
    ],
  },
  {
    id: 'studio-karaoke-captions-v1',
    kind: 'feature',
    title: 'Karaoke captions',
    summary:
      'Captions can pop the spoken word. Open a talking-head cut, go to Captions, and pick Karaoke.',
    releasedAt: '2026-08-24T01:33:10.000Z',
    audience: 'editor',
    steps: [
      {
        id: 'open-studio',
        title: 'Open Studio',
        body: 'Open **Studio** from the sidebar and pick a talking-head project.',
        route: '/studio',
        spotlight: 'nav-studio',
      },
      {
        id: 'captions-karaoke',
        title: 'Pick Karaoke',
        body: 'In the media bin, open **Captions** and click **Karaoke**. Play the cut — the spoken word should pop. Typed lines without timings stay a band.',
        route: '/studio',
      },
    ],
  },
  {
    id: 'studio-caption-highlights-v1',
    kind: 'feature',
    title: 'Caption highlights and marks',
    summary:
      'Keywords can pick up your brand color, with a small graphic after a word. Turn them off in Captions or on the selected caption.',
    releasedAt: '2026-08-24T09:00:00.000Z',
    audience: 'editor',
    steps: [
      {
        id: 'open-studio',
        title: 'Open Studio',
        body: 'Open **Studio** from the sidebar and pick a talking-head project with captions.',
        route: '/studio',
        spotlight: 'nav-studio',
      },
      {
        id: 'captions-highlights',
        title: 'Highlights and Marks',
        body: 'In the media bin, open **Captions**. **Highlights** paints a keyword in your brand color. **Marks** adds a small graphic after it. Select the caption on the timeline and use **Clear highlights** or **Clear marks** if you want them gone.',
        route: '/studio',
      },
    ],
  },
  {
    id: 'studio-chat-history-popover-v1',
    kind: 'feature',
    title: 'Previous chats',
    summary: 'The clock in Studio chat opens a searchable list of earlier threads, grouped by day.',
    releasedAt: '2026-08-29T13:00:00.000Z',
    audience: 'editor',
    includeNewUsers: false,
    steps: [
      {
        id: 'open-studio',
        title: 'Open Studio',
        body: 'Open **Studio** from the sidebar and pick a project that has more than one chat.',
        route: '/studio',
        spotlight: 'nav-studio',
      },
      {
        id: 'open-history',
        title: 'Previous chats',
        body: 'Click the **clock** in the chat header. Search or pick a thread under Today, Yesterday, or older. Escape or a click outside closes it.',
        route: '/studio',
        spotlight: 'studio-chat-history',
      },
    ],
  },
]
