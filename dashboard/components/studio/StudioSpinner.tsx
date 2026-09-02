'use client'

type StudioSpinnerSize = 'sm' | 'md' | 'lg'

type StudioSpinnerProps = {
  size?: StudioSpinnerSize
  /** Visible label. Screen readers always get a status. */
  label?: string
}

export const StudioSpinner = ({ size = 'md', label }: StudioSpinnerProps) => (
  <span className={`studio-spinner studio-spinner-${size}`} role="status" aria-live="polite">
    <span className="studio-spinner-orbit" aria-hidden>
      <span className="studio-spinner-core" />
    </span>
    {label ? <span className="studio-spinner-label">{label}</span> : null}
    {!label ? <span className="sr-only">Loading</span> : null}
  </span>
)

type StudioPageLoadingProps = {
  message?: string
}

export const StudioPageLoading = ({ message = 'Loading Studio…' }: StudioPageLoadingProps) => (
  <div className="studio-page-loading" role="status" aria-live="polite">
    <StudioSpinner size="lg" label={message} />
  </div>
)
