'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type StudioTooltipProps = {
  /** Trigger content (pill, icon, label). */
  children: ReactNode
  /** Optional short eyebrow above the body. */
  label?: string
  /** Main explainer copy. */
  body: string
  /** Optional mono meta line (timings, ids). */
  meta?: string
  /** Prefer open direction; falls back if clipped. */
  placement?: 'up' | 'down'
  className?: string
}

type TipBox = { top: number; left: number; placement: 'up' | 'down'; width: number }

const SHOW_DELAY_MS = 280
const HIDE_DELAY_MS = 90
const TIP_MAX_WIDTH = 260

/**
 * Polished hover/focus tip — soft delay, portaled panel, reduced-motion aware.
 * Prefer this over native `title` for founder-facing explainers.
 */
export const StudioTooltip = ({
  children,
  label,
  body,
  meta,
  placement = 'up',
  className,
}: StudioTooltipProps) => {
  const tipId = useId()
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const tipRef = useRef<HTMLSpanElement | null>(null)
  const showTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<TipBox | null>(null)

  const clearTimers = useCallback(() => {
    if (showTimer.current != null) window.clearTimeout(showTimer.current)
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    showTimer.current = null
    hideTimer.current = null
  }, [])

  const syncBox = useCallback(() => {
    const trigger = rootRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 8
    const width = Math.min(TIP_MAX_WIDTH, window.innerWidth - 16)
    const preferUp = placement === 'up'
    const spaceAbove = rect.top - gap - 8
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8
    const nextPlacement: 'up' | 'down' =
      preferUp && spaceAbove >= 72
        ? 'up'
        : !preferUp && spaceBelow >= 72
          ? 'down'
          : spaceAbove >= spaceBelow
            ? 'up'
            : 'down'
    const left = Math.min(
      window.innerWidth - width - 8,
      Math.max(8, rect.left + rect.width / 2 - width / 2),
    )
    const top = nextPlacement === 'up' ? rect.top - gap : rect.bottom + gap
    setBox({ top, left, placement: nextPlacement, width })
  }, [placement])

  const show = useCallback(() => {
    clearTimers()
    showTimer.current = window.setTimeout(() => {
      syncBox()
      setOpen(true)
    }, SHOW_DELAY_MS)
  }, [clearTimers, syncBox])

  const hide = useCallback(() => {
    clearTimers()
    hideTimer.current = window.setTimeout(() => setOpen(false), HIDE_DELAY_MS)
  }, [clearTimers])

  useLayoutEffect(() => {
    if (!open) {
      setBox(null)
      return
    }
    syncBox()
  }, [open, syncBox])

  useEffect(() => {
    if (!open) return
    const onReposition = () => syncBox()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, syncBox])

  useEffect(() => () => clearTimers(), [clearTimers])

  // After open, if tip height pushes off-screen when anchored up via bottom calc,
  // adjust using measured height for upward placement.
  useLayoutEffect(() => {
    if (!open || !box || !tipRef.current || box.placement !== 'up') return
    const height = tipRef.current.getBoundingClientRect().height
    const trigger = rootRef.current?.getBoundingClientRect()
    if (!trigger) return
    const nextTop = trigger.top - 8 - height
    if (Math.abs(nextTop - box.top) > 0.5) {
      setBox({ ...box, top: Math.max(8, nextTop) })
    }
  }, [open, box])

  const tip =
    open && box && typeof document !== 'undefined'
      ? createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={`studio-tooltip-panel is-${box.placement}`}
            style={{ top: box.top, left: box.left, width: box.width }}
            onMouseEnter={() => {
              clearTimers()
              setOpen(true)
            }}
            onMouseLeave={hide}
          >
            {label ? <span className="studio-tooltip-label">{label}</span> : null}
            <span className="studio-tooltip-body">{body}</span>
            {meta ? <span className="studio-tooltip-meta">{meta}</span> : null}
          </span>,
          document.body,
        )
      : null

  return (
    <span
      ref={rootRef}
      className={['studio-tooltip', className ?? ''].filter(Boolean).join(' ')}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span className="studio-tooltip-trigger" aria-describedby={open ? tipId : undefined}>
        {children}
      </span>
      {tip}
    </span>
  )
}
