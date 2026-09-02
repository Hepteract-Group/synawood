'use client'

import { useCallback, useState } from 'react'

const readCollapsed = (key: string): boolean => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(key) === '1'
}

/**
 * Persist a boolean pane collapse flag in localStorage (ADR-0016 layout guardrail).
 * Stored sizes from useDragResize stay untouched while collapsed.
 */
export const usePaneCollapse = (storageKey: string) => {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey))

  const set = useCallback(
    (next: boolean) => {
      setCollapsed(next)
      window.localStorage.setItem(storageKey, next ? '1' : '0')
    },
    [storageKey],
  )

  const collapse = useCallback(() => set(true), [set])
  const expand = useCallback(() => set(false), [set])

  return { collapsed, collapse, expand }
}
