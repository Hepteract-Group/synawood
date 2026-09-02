'use client'

import { useEffect } from 'react'
import { presentStudioError, type StudioErrorTone } from '../../lib/humanize-studio-error'

type StudioErrorBannerProps = {
  message: string
  onDismiss: () => void
}

const toneLabel: Record<StudioErrorTone, string> = {
  info: 'Notice',
  warning: 'Heads up',
  danger: 'Error',
}

export const StudioErrorBanner = ({ message, onDismiss }: StudioErrorBannerProps) => {
  const { title, body, tone, action } = presentStudioError(message)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  useEffect(() => {
    if (tone !== 'info') return
    const timer = window.setTimeout(() => onDismiss(), 7000)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss, tone])

  return (
    <div
      className={`studio-error-banner is-${tone}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="studio-error-banner-glow" aria-hidden />
      <div className="studio-error-banner-icon" aria-hidden>
        {tone === 'info' ? 'i' : '!'}
      </div>
      <div className="studio-error-banner-copy">
        <p className="studio-error-banner-kicker">{toneLabel[tone]}</p>
        <p className="studio-error-banner-title">{title}</p>
        <p className="studio-error-banner-body">{body}</p>
        {action ? (
          <a href={action.href} className="btn btn-primary btn-sm studio-error-banner-cta">
            {action.label}
          </a>
        ) : null}
      </div>
      <button
        type="button"
        className="studio-error-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  )
}
