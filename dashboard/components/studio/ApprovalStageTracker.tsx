'use client'

type Stage = { key: string; label: string; minRole: string }

type ApprovalStageTrackerProps = {
  stages: Stage[]
  currentStageIndex: number
  status?: string
  compact?: boolean
}

export const ApprovalStageTracker = ({
  stages,
  currentStageIndex,
  status = 'open',
  compact = false,
}: ApprovalStageTrackerProps) => {
  if (stages.length === 0) return null
  const finished = status === 'completed' || status === 'overridden'
  return (
    <ol
      className={`approval-stage-tracker${compact ? ' is-compact' : ''}`}
      aria-label="Approval stages"
    >
      {stages.map((stage, index) => {
        const done = finished || index < currentStageIndex
        const current = status === 'open' && index === currentStageIndex
        return (
          <li
            key={stage.key}
            className={done ? 'is-done' : current ? 'is-current' : 'is-pending'}
            aria-current={current ? 'step' : undefined}
          >
            <span className="approval-stage-dot" aria-hidden />
            <span className="approval-stage-label">{stage.label}</span>
            {index < stages.length - 1 ? (
              <span className="approval-stage-rail" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
