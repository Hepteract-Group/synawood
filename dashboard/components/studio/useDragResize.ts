'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type DragResizeOptions = {
  /** localStorage key — layout persists across reloads (ADR-0016 guardrail). */
  storageKey: string
  initial: number
  min: number
  max: number
  /** Axis the drag moves on. */
  direction: 'horizontal' | 'vertical'
  /**
   * Negate the drag delta. Use when the handle sits on the opposite side of the
   * element it sizes (right pane grows as the pointer moves left; timeline grows
   * as the pointer moves up).
   */
  invert?: boolean
  /** When false (e.g. sidebar expanded), the previous value is preserved but not applied. */
  enabled?: boolean
}

const readStored = (key: string): number | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Pointer-drag resize for a pane divider. Returns the current size and the
 * props to spread on the divider handle. Pure DOM math — no layout library.
 */
export const useDragResize = ({
  storageKey,
  initial,
  min,
  max,
  direction,
  invert = false,
  enabled = true,
}: DragResizeOptions) => {
  const [stored, setStored] = useState<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setStored(readStored(storageKey))
  }, [storageKey])

  useEffect(() => () => cleanupRef.current?.(), [])

  const size = clamp(stored ?? initial, min, max)

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return
      event.preventDefault()
      const startPos = direction === 'horizontal' ? event.clientX : event.clientY
      const startSize = size
      const target = event.currentTarget
      const pointerId = event.pointerId
      target.setPointerCapture(pointerId)

      const onMove = (move: PointerEvent) => {
        const pos = direction === 'horizontal' ? move.clientX : move.clientY
        const delta = (pos - startPos) * (invert ? -1 : 1)
        setStored(clamp(startSize + delta, min, max))
      }
      const finish = () => {
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', finish)
        target.removeEventListener('pointercancel', finish)
        if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
        cleanupRef.current = null
        setStored((current) => {
          if (current !== null) {
            window.localStorage.setItem(storageKey, String(current))
          }
          return current
        })
      }
      cleanupRef.current = finish
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', finish)
      target.addEventListener('pointercancel', finish)
    },
    [direction, enabled, invert, max, min, size, storageKey],
  )

  return { size, handleProps: { onPointerDown } }
}
