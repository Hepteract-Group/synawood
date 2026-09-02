'use client'

import {
  clampPipLayout,
  layoutRegions,
  swapPipSides,
  type PipLayout,
} from '@synawood/creative/project/pip-layout'
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

type DragKind = 'move' | 'se' | 'split' | 'swap'

type PipFrameOverlayProps = {
  layout: PipLayout
  disabled?: boolean
  onPreview: (next: PipLayout) => void
  onCommit: (next: PipLayout) => void
}

export const PipFrameOverlay = ({
  layout,
  disabled = false,
  onPreview,
  onCommit,
}: PipFrameOverlayProps) => {
  const startRef = useRef<{
    kind: DragKind
    pointerId: number
    x0: number
    y0: number
    layout: PipLayout
    bounds: DOMRect
  } | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)

  const applyDelta = (event: ReactPointerEvent<HTMLElement>, commit: boolean) => {
    const start = startRef.current
    if (!start || event.pointerId !== start.pointerId) return
    const dx = (event.clientX - start.x0) / start.bounds.width
    const dy = (event.clientY - start.y0) / start.bounds.height
    let next = start.layout
    if (start.kind === 'split') {
      const axis = start.layout.axis ?? 'horizontal'
      const mainFirst = (start.layout.mainSide ?? 'start') === 'start'
      const delta = axis === 'horizontal' ? dx : dy
      next = clampPipLayout({
        ...start.layout,
        mode: 'split',
        mainPct: (start.layout.mainPct ?? 0.5) + (mainFirst ? delta : -delta),
      })
    } else if (start.kind === 'swap') {
      const axis = start.layout.axis ?? 'horizontal'
      const crossed = axis === 'horizontal' ? Math.abs(dx) > 0.18 : Math.abs(dy) > 0.18
      next = commit && crossed ? swapPipSides(start.layout) : start.layout
      if (!commit) {
        onPreview(crossed ? swapPipSides(start.layout) : start.layout)
        return
      }
    } else if (start.kind === 'move') {
      next = clampPipLayout({
        ...start.layout,
        x: start.layout.x + dx,
        y: start.layout.y + dy,
      })
    } else {
      next = clampPipLayout({
        ...start.layout,
        width: start.layout.width + dx,
        height: start.layout.height + dy,
      })
    }
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

  const regions = layoutRegions(layout)
  const split = layout.mode === 'split'
  const axis = layout.axis ?? 'horizontal'
  const mainFirst = (layout.mainSide ?? 'start') === 'start'
  const splitPct = layout.mainPct ?? 0.5
  const dividerPos = mainFirst ? splitPct : 1 - splitPct

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
      {split ? (
        <>
          <div
            className={`pip-frame-box is-split is-main${disabled ? ' is-disabled' : ''}`}
            style={{
              left: `${regions.main.x * 100}%`,
              top: `${regions.main.y * 100}%`,
              width: `${regions.main.width * 100}%`,
              height: `${regions.main.height * 100}%`,
            }}
            onPointerDown={(event) => beginDrag('swap', event)}
          >
            <span className="pip-frame-box-label">Main · drag to swap</span>
          </div>
          <div
            className={`pip-frame-box is-split${disabled ? ' is-disabled' : ''}`}
            style={{
              left: `${regions.pip.x * 100}%`,
              top: `${regions.pip.y * 100}%`,
              width: `${regions.pip.width * 100}%`,
              height: `${regions.pip.height * 100}%`,
            }}
            onPointerDown={(event) => beginDrag('swap', event)}
          >
            <span className="pip-frame-box-label">Overlay · drag to swap</span>
          </div>
          <button
            type="button"
            className={`pip-frame-divider is-${axis}${disabled ? ' is-disabled' : ''}`}
            style={
              axis === 'horizontal'
                ? { left: `${dividerPos * 100}%` }
                : { top: `${dividerPos * 100}%` }
            }
            aria-label="Resize split"
            disabled={disabled}
            onPointerDown={(event) => beginDrag('split', event)}
          />
        </>
      ) : (
        <div
          className={`pip-frame-box${disabled ? ' is-disabled' : ''}`}
          style={{
            left: `${regions.pip.x * 100}%`,
            top: `${regions.pip.y * 100}%`,
            width: `${regions.pip.width * 100}%`,
            height: `${regions.pip.height * 100}%`,
          }}
          onPointerDown={(event) => beginDrag('move', event)}
        >
          <span className="pip-frame-box-label">Drag to move</span>
          <button
            type="button"
            className="pip-frame-handle"
            aria-label="Resize picture-in-picture"
            disabled={disabled}
            onPointerDown={(event) => beginDrag('se', event)}
          />
        </div>
      )}
    </div>
  )
}
