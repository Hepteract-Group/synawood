'use client'

import { useId } from 'react'

type SessionSpendProps = {
  sessionGbp: number
  confirmSpend: boolean
  onConfirmSpendChange: (value: boolean) => void
  disabled?: boolean
  onOpenModelChoices?: () => void
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Spend on this project from the cost ledger. */
export const SessionSpend = ({
  sessionGbp,
  confirmSpend,
  onConfirmSpendChange,
  disabled,
  onOpenModelChoices,
}: SessionSpendProps) => {
  const labelId = useId()

  return (
    <div className="session-spend">
      <div className="session-spend-row">
        <span className="session-spend-label">Session</span>
        <strong className="session-spend-value tabular-nums">{gbp.format(sessionGbp)}</strong>
        <span className="session-spend-actions">
          {onOpenModelChoices ? (
            <button
              type="button"
              className="session-spend-link"
              disabled={disabled}
              onClick={onOpenModelChoices}
            >
              Model choices
            </button>
          ) : null}
          <a className="session-spend-link" href="/usage">
            Ledger
          </a>
        </span>
      </div>
      <div className="spend-toggle">
        <span className="spend-toggle-label" id={labelId}>
          Allow paid models
        </span>
        <button
          type="button"
          role="switch"
          className={`spend-toggle-switch${confirmSpend ? ' is-on' : ''}`}
          aria-labelledby={labelId}
          aria-checked={confirmSpend}
          disabled={disabled}
          onClick={() => onConfirmSpendChange(!confirmSpend)}
        >
          <span className="spend-toggle-thumb" aria-hidden />
        </button>
      </div>
    </div>
  )
}
