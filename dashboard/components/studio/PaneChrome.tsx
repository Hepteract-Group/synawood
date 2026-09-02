'use client'

import type { ReactNode } from 'react'

type PaneCollapseControlProps = {
  title: string
  onClick: () => void
  /** Text glyph (Media/Chat). Prefer `children` for an SVG icon. */
  glyph?: string
  children?: ReactNode
}

/** Compact hide control for an open Studio pane. */
export const PaneCollapseControl = ({
  title,
  onClick,
  glyph,
  children,
}: PaneCollapseControlProps) => (
  <button
    type="button"
    className="studio-pane-collapse"
    onClick={onClick}
    title={title}
    aria-label={title}
  >
    {children ?? <span aria-hidden>{glyph}</span>}
  </button>
)

type PaneExpandRailProps = {
  label: string
  title: string
  onClick: () => void
  orientation: 'vertical' | 'horizontal'
}

/** Thin restore control when a Studio pane is fully minimized. */
export const PaneExpandRail = ({ label, title, onClick, orientation }: PaneExpandRailProps) => (
  <button
    type="button"
    className={`studio-pane-expand-rail is-${orientation}`}
    onClick={onClick}
    title={title}
    aria-label={title}
  >
    <span>{label}</span>
  </button>
)
