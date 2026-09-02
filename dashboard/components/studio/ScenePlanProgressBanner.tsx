'use client'

type ScenePlanProgressBannerProps = {
  phase: 'inferring' | 'preview' | 'applying' | 'failed'
  sceneCount: number
  error?: string | null
  onReview: () => void
  onDismiss: () => void
  onApply?: () => void
  applyDisabled?: boolean
}

const labelFor = (
  phase: ScenePlanProgressBannerProps['phase'],
  sceneCount: number,
  error?: string | null,
): string => {
  if (phase === 'inferring') return 'Inferring story beats…'
  if (phase === 'applying') return `Applying ${sceneCount} scene${sceneCount === 1 ? '' : 's'}…`
  if (phase === 'failed') return error?.trim() || 'Scene plan interrupted'
  return `Scene plan ready · ${sceneCount} beat${sceneCount === 1 ? '' : 's'}`
}

/**
 * Persistent strip for scene Infer/Apply — survives modal minimize and timeline collapse.
 */
export const ScenePlanProgressBanner = ({
  phase,
  sceneCount,
  error,
  onReview,
  onDismiss,
  onApply,
  applyDisabled = false,
}: ScenePlanProgressBannerProps) => {
  const busy = phase === 'inferring' || phase === 'applying'
  return (
    <div
      className={`scene-plan-banner is-${phase}`}
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      <div className="scene-plan-banner-copy">
        <strong>{labelFor(phase, sceneCount, error)}</strong>
        {phase === 'preview' ? (
          <span className="muted"> Review the draft, then apply to the scene strip.</span>
        ) : null}
        {phase === 'failed' && error ? <span className="muted"> {error}</span> : null}
      </div>
      <div className="scene-plan-banner-actions">
        {phase === 'preview' || phase === 'failed' ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReview}>
            {phase === 'failed' ? 'Details' : 'Review'}
          </button>
        ) : null}
        {phase === 'preview' && onApply ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={applyDisabled}
            onClick={onApply}
          >
            Apply
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onDismiss}>
          {busy ? 'Working…' : 'Dismiss'}
        </button>
      </div>
    </div>
  )
}
