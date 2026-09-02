'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BillingSummary } from '@/app/api/billing/summary/route'

const POLL_INTERVAL_MS = 30_000

export type BillingSummaryState = BillingSummary & {
  loading: boolean
}

// Start fail-closed: assume billing may be active until the first successful
// response. Chat send still goes through while loading when Allow paid models is on (#1328).
const IDLE: BillingSummaryState = {
  billingEnabled: true,
  walletBalanceGbp: 0,
  generationFrozen: false,
  hasWallet: false,
  monthlyCapGbp: null,
  maxAllowedCapGbp: null,
  spentThisPeriodFromWalletGbp: 0,
  spentThisWeekGbp: 0,
  spentThisMonthGbp: 0,
  planId: null,
  trialEndsAt: null,
  seatLimit: null,
  seatsUsed: null,
  paidHostedVideo: null,
  watermarkExports: null,
  role: null,
  loading: true,
}

export const useBillingSummary = (
  productId: string | null,
): BillingSummaryState & { refresh: () => void } => {
  const [state, setState] = useState<BillingSummaryState>(IDLE)
  const cancelRef = useRef(false)

  const load = useCallback(async () => {
    if (!productId) {
      setState({ ...IDLE, loading: false })
      return
    }
    const url = `/api/billing/summary?productId=${encodeURIComponent(productId)}`
    try {
      const response = await fetch(url)
      if (cancelRef.current) return
      if (!response.ok) {
        // On a transient error keep the last known billing state so the
        // spend modal does not silently bypass on a failed poll.
        setState((prev) => ({ ...prev, loading: false }))
        return
      }
      const body = (await response.json()) as BillingSummary
      if (cancelRef.current) return
      setState({ ...body, loading: false })
    } catch {
      // Network error: preserve previous state (fail-closed for billing gate).
      if (cancelRef.current) return
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [productId])

  useEffect(() => {
    cancelRef.current = false
    setState(IDLE)
    void load()
    const timer = setInterval(() => {
      void load()
    }, POLL_INTERVAL_MS)
    return () => {
      cancelRef.current = true
      clearInterval(timer)
    }
  }, [load])

  return { ...state, refresh: load }
}
