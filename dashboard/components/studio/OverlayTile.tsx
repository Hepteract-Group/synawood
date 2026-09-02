'use client'

import type { DragEvent, ReactNode } from 'react'

type OverlayTileProps = {
  label: string
  selected?: boolean
  disabled?: boolean
  draggable?: boolean
  title?: string
  onClick: () => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  children: ReactNode
}

export const OverlayTile = ({
  label,
  selected = false,
  disabled = false,
  draggable = false,
  title,
  onClick,
  onDragStart,
  children,
}: OverlayTileProps) => (
  <button
    type="button"
    className={selected ? 'overlay-tile is-selected' : 'overlay-tile'}
    disabled={disabled}
    draggable={draggable && !disabled}
    title={title}
    aria-pressed={selected}
    aria-label={label}
    onClick={onClick}
    onDragStart={onDragStart}
  >
    <span className="overlay-tile-preview">{children}</span>
    <span className="overlay-tile-label">{label}</span>
  </button>
)
