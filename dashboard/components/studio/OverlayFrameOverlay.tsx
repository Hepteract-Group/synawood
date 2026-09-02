'use client'

import { clampOverlayLayout } from '@synawood/creative/overlays'
import type { OverlayLayout } from '@synawood/creative/project/schema'
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

type DragKind = 'move' | 'se'

type OverlayFrameOverlayProps = {
  layout: OverlayLayout
  label?: string
  disabled?: boolean
  onPreview: (next: OverlayLayout) => void
  onCommit: (next: OverlayLayout) => void
}

export const OverlayFrameOverlay = ({
  layout,
  label = 'Text',
  disabled = false,
  onPreview,
  onCommit,
}: OverlayFrameOverlayProps) => {
  const startRef = useRef<{
    kind: DragKind
    pointerId: number
    x0: number
    y0: number
    layout: OverlayLayout
    bounds: DOMRect
  } | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)

  const applyDelta = (event: ReactPointerEvent<HTMLElement>, commit: boolean) => {
    const start = startRef.current
    if (!start || event.pointerId !== start.pointerId) return
    const dx = (event.clientX - start.x0) / start.bounds.width
    const dy = (event.clientY - start.y0) / start.bounds.height
    const next =
      start.kind === 'move'
        ? clampOverlayLayout({ ...start.layout, x: start.layout.x + dx, y: start.layout.y + dy })
        : clampOverlayLayout({
            ...start.layout,
            width: start.layout.width + dx,
            height: start.layout.height + dy,
          })
    if (commit) onCommit(next)
    else onPreview(next)
  }

  const beginDrag = (kind: DragKind, event: ReactPointerEvent<HTMLElement>) => {
    if (disabled) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = frameRef.current?.getBoundingClientRect()
    if (!bounds) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startRef.current = {
      kind,
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      layout,
      bounds,
    }
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!startRef.current || event.pointerId !== startRef.current.pointerId) return
    applyDelta(event, true)
    startRef.current = null
  }

  return (
    <div
      ref={frameRef}
      className="pip-frame-overlay"
      onPointerMove={(event) => {
        if (!startRef.current) return
        applyDelta(event, false)
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className={`pip-frame-box${disabled ? ' is-disabled' : ''}`}
        style={{
          left: `${layout.x * 100}%`,
          top: `${layout.y * 100}%`,
          width: `${layout.width * 100}%`,
          height: `${layout.height * 100}%`,
          transform: `rotate(${layout.rotation}deg)`,
        }}
        onPointerDown={(event) => beginDrag('move', event)}
        aria-label={`${label}. Drag to move`}
      >
        <span className="pip-frame-box-label">{label} · drag to move</span>
        <button
          type="button"
          className="pip-frame-handle"
          aria-label="Resize overlay"
          disabled={disabled}
          onPointerDown={(event) => beginDrag('se', event)}
        />
      </div>
    </div>
  )
}
