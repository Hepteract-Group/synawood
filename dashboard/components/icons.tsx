import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

export const IconLayoutDashboard = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

export const IconPackage = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.29 7 12 12l8.71-5" />
    <path d="M12 22V12" />
  </svg>
)

export const IconClapperboard = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
    <path d="m6.2 5.3 3.1 3.9" />
    <path d="m12.4 3.4 3.1 4" />
    <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
)

export const IconKanban = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 7v10" />
    <path d="M12 7v6" />
    <path d="M16 7v8" />
  </svg>
)

export const IconSparkles = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m12 3 1.9 5.8L20 12l-6.1 3.2L12 21l-1.9-5.8L4 12l6.1-3.2Z" />
  </svg>
)

export const IconChart = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 3v18h18" />
    <path d="M7 16v-5" />
    <path d="M12 16V8" />
    <path d="M17 16v-9" />
  </svg>
)

export const IconPlay = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 5v14l11-7Z" fill="currentColor" stroke="none" />
  </svg>
)

export const IconPause = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconMaximize = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
)

export const IconMinimize = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
  </svg>
)

/** Collapse a bottom pane — chevron into the lower panel half (not a download tray). */
export const IconCollapsePanel = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 14h18" />
    <path d="m15 8-3 3-3-3" />
  </svg>
)

export const IconZoomReset = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
)

export const IconDownload = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
)

export const IconCheck = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const IconUndo = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13" />
  </svg>
)

export const IconRedo = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 13" />
  </svg>
)

export const IconScissors = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.12 15.88" />
    <path d="M14.47 14.48 20 20" />
    <path d="M8.12 8.12 12 12" />
  </svg>
)

export const IconFitDuration = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2" />
    <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M8 12h8" />
  </svg>
)

export const IconSelectLeft = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M15 18 9 12l6-6" />
    <path d="M19 12H9" />
  </svg>
)

export const IconSelectRight = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m9 18 6-6-6-6" />
    <path d="M5 12h10" />
  </svg>
)

export const IconRipple = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h7" />
    <path d="M4 12h5" />
    <path d="M4 17h7" />
    <path d="m14 7 6 5-6 5" />
  </svg>
)

export const IconTrash = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
)

export const IconMoreVertical = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="5" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none" />
  </svg>
)

export const IconShare = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4" />
    <path d="m15.4 6.5-6.8 4" />
  </svg>
)

/** Simple channel marks for the post chrome (not official brand kits). */
export const IconChannelLinkedIn = (props: IconProps) => (
  <svg {...base} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
    <path d="M6.5 9H3.7v11h2.8V9ZM5.1 3.5A1.65 1.65 0 1 0 5.1 6.8 1.65 1.65 0 0 0 5.1 3.5ZM20.3 9.1c-1.5 0-2.5.7-3.1 1.5V9H14.5v11h2.8v-5.8c0-1.5.4-3 2.2-3s1.9 1.3 1.9 3.1V20H24v-6.4c0-3.3-1.8-4.5-3.7-4.5Z" />
  </svg>
)

export const IconChannelX = (props: IconProps) => (
  <svg {...base} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
    <path d="M18.2 3H21l-6.6 7.6L22 21h-5.5l-4.3-5.6L7 21H4.2l7.1-8.1L2 3h5.6l3.9 5.2L18.2 3Zm-1 16.2h1.5L7.9 4.7H6.3l10.9 14.5Z" />
  </svg>
)

export const IconChannelBlog = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
  </svg>
)

export const IconChannelTikTok = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
)

export const IconChevronLeft = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)

export const IconChevronRight = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export const IconImage = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="1.75" />
    <path d="m21 15-4.5-4.5L7 20" />
  </svg>
)

export const IconSettings = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)

export const IconFilm = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M7 4v16" />
    <path d="M17 4v16" />
    <path d="M2 9h5" />
    <path d="M2 15h5" />
    <path d="M17 9h5" />
    <path d="M17 15h5" />
  </svg>
)

export const IconAudio = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

export const IconFile = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  </svg>
)

export const IconLayers = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m12 2 9 5-9 5-9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </svg>
)

export const IconPresentation = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M2 6h20" />
    <path d="M4 6v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6" />
    <path d="M12 18v4" />
    <path d="M8 22h8" />
  </svg>
)

export const IconSearch = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const IconAt = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
  </svg>
)

export const IconPlus = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

export const IconClock = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const IconX = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconArrowUp = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
)

export const IconStopSquare = (props: IconProps) => (
  <svg {...base} fill="currentColor" stroke="none" {...props}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
  </svg>
)

export const IconHome = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m3 10 9-7 9 7" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  </svg>
)

export const IconLogOut = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)
