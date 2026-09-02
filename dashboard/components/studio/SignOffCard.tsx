'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ApprovalStageTracker } from './ApprovalStageTracker'
import { humanizeStudioError } from '@/lib/humanize-studio-error'
import {
  STRUCTURE_FILL_BUTTON,
  STRUCTURE_FILL_ERROR,
  STRUCTURE_FILLING,
  STRUCTURE_SIGNOFF_BODY,
  STRUCTURE_SIGNOFF_LABEL,
} from '@/lib/studio-structure-copy'

type ClaimHit = {
  ruleId: string
  severity: string
  match: string
  suggestion: string
  source?: string
}

type Stage = { key: string; label: string; minRole: string }

type GovernanceState = {
  policy: {
    body: {
      stages: Stage[]
      disclaimer: { required: boolean; text: string }
    }
  } | null
  run: {
    id: string
    status: string
    currentStageIndex: number
    stages: Stage[]
  } | null
  claimScan: { ok: boolean; hits: ClaimHit[] } | null
  disclaimerRequired: boolean
  disclaimerText: string | null
  canSignOff: boolean
  canOverride: boolean
  structureBeatCount?: number
  sceneCount?: number
  preflight?: { code: string; message: string }[]
}

type SignOffCardProps = {
  projectId: string
  revision: number
  open: boolean
  onClose: () => void
  onCompleted: () => void | Promise<void>
}

export const SignOffCard = ({
  projectId,
  revision,
  open,
  onClose,
  onCompleted,
}: SignOffCardProps) => {
  const titleId = useId()
  const primaryRef = useRef<HTMLButtonElement | null>(null)
  const [state, setState] = useState<GovernanceState | null>(null)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [signOffRevision, setSignOffRevision] = useState(revision)

  useEffect(() => {
    if (!open) return
    setError(null)
    setReason('')
    setSignOffRevision(revision)
    setLoading(true)
    void (async () => {
      const res = await fetch(`/api/studio/projects/${projectId}/approvals`, {
        credentials: 'same-origin',
      })
      const data = (await res.json().catch(() => ({}))) as GovernanceState & {
        error?: string
      }
      if (!res.ok) {
        setError(humanizeStudioError(data.error ?? 'Failed to load approval state'))
        setLoading(false)
        return
      }
      setState(data)
      setLoading(false)
    })()
  }, [open, projectId])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => primaryRef.current?.focus(), 40)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, pending])

  if (!open) return null

  const stages = state?.run?.stages ?? state?.policy?.body.stages ?? []
  const stageIndex = state?.run?.currentStageIndex ?? 0
  const blockers = state?.claimScan?.hits.filter((hit) => hit.severity === 'block') ?? []
  const warns = state?.claimScan?.hits.filter((hit) => hit.severity === 'warn').slice(0, 3) ?? []
  const isFinalStage = stages.length > 0 && stageIndex >= stages.length - 1
  const preflight = state?.preflight ?? []
  const currentStage = stages[stageIndex]

  const runAction = async (action: 'sign_off' | 'override' | 'reject') => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/approvals`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          expectedRevision: signOffRevision,
          reason: reason.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to ${action}`)
      }
      await onCompleted()
      onClose()
    } catch (err) {
      setError(humanizeStudioError(err instanceof Error ? err.message : 'Approval failed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="dialog-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="dialog-backdrop"
        onClick={() => {
          if (!pending) onClose()
        }}
        aria-label="Cancel"
      />
      <div className="dialog-panel sign-off-panel">
        <p className="eyebrow">Governance</p>
        <h3 className="dialog-title" id={titleId}>
          Approval sign-off
        </h3>
        <p className="dialog-body">
          {currentStage
            ? `Current stage: ${currentStage.label}. Final is retained after the last stage — or an owner override.`
            : 'Final is retained after every required stage is signed, or an owner override.'}
        </p>

        {loading ? <p className="muted sign-off-loading">Loading policy…</p> : null}

        {!loading && stages.length > 0 ? (
          <ApprovalStageTracker
            stages={stages}
            currentStageIndex={stageIndex}
            status={state?.run?.status ?? 'open'}
          />
        ) : null}

        {state?.disclaimerRequired ? (
          <div className="sign-off-callout sign-off-callout-disclaimer">
            <span className="sign-off-callout-label">Disclaimer on export</span>
            <p>{state.disclaimerText ?? 'Missing — sync the product approval policy.'}</p>
          </div>
        ) : null}

        {!loading && blockers.length > 0 ? (
          <div className="sign-off-callout sign-off-callout-danger" role="alert">
            <span className="sign-off-callout-label">Claim scanner blocked</span>
            <ul>
              {blockers.slice(0, 5).map((hit) => (
                <li key={`${hit.ruleId}-${hit.match}`}>
                  <span className="mono sign-off-hit">{hit.match}</span>
                  <span>{hit.suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && blockers.length === 0 && state ? (
          <p className="sign-off-scan-ok" role="status">
            Claim scanner clear
            {warns.length > 0 ? ` · ${warns.length} warning${warns.length === 1 ? '' : 's'}` : ''}
          </p>
        ) : null}

        {!loading && (state?.preflight?.length ?? 0) > 0 ? (
          <div className="sign-off-callout sign-off-callout-danger" role="alert">
            <span className="sign-off-callout-label">Approve blocked</span>
            <ul>
              {state?.preflight?.map((item) => (
                <li key={item.code}>{item.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="sign-off-field">
          <span>Note / reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Optional for sign-off · required for override (≥8) and reject"
            disabled={pending || loading}
          />
        </label>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && (state?.structureBeatCount ?? 0) === 0 ? (
          <div className="sign-off-callout sign-off-callout-disclaimer" role="status">
            <span className="sign-off-callout-label">{STRUCTURE_SIGNOFF_LABEL}</span>
            <p>{STRUCTURE_SIGNOFF_BODY}</p>
            {busy ? <p>{busy}</p> : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending || loading || Boolean(busy) || (state?.sceneCount ?? 0) === 0}
              onClick={() => {
                setBusy(STRUCTURE_FILLING)
                void (async () => {
                  const res = await fetch(`/api/studio/projects/${projectId}/structure`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      expectedRevision: signOffRevision,
                      action: 'derive',
                    }),
                  })
                  const data = (await res.json().catch(() => ({}))) as {
                    error?: string
                    project?: { revision: number; creativeStructure?: { beats?: unknown[] } }
                  }
                  if (!res.ok) throw new Error(data.error ?? STRUCTURE_FILL_ERROR)
                  const nextRevision = data.project?.revision ?? signOffRevision
                  setSignOffRevision(nextRevision)
                  setState((current) =>
                    current
                      ? {
                          ...current,
                          structureBeatCount: data.project?.creativeStructure?.beats?.length ?? 0,
                        }
                      : current,
                  )
                  await onCompleted()
                })()
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : STRUCTURE_FILL_ERROR),
                  )
                  .finally(() => setBusy(null))
              }}
            >
              {STRUCTURE_FILL_BUTTON}
            </button>
          </div>
        ) : null}

        <div className="dialog-actions sign-off-actions">
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending || loading || reason.trim().length < 3}
            onClick={() => void runAction('reject')}
            title="Return to draft and queue a Studio Agent revision prompt"
          >
            Reject
          </button>
          {state?.canOverride ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending || loading || reason.trim().length < 8}
              onClick={() => void runAction('override')}
              title="Skip remaining stages — claim scanner still applies"
            >
              Override
            </button>
          ) : null}
          <button
            type="button"
            ref={primaryRef}
            className="btn btn-primary"
            disabled={
              pending ||
              loading ||
              blockers.length > 0 ||
              preflight.length > 0 ||
              state?.canSignOff === false
            }
            onClick={() => void runAction('sign_off')}
            title={
              state?.canSignOff === false
                ? `Needs role: ${currentStage?.minRole ?? 'editor'}`
                : blockers.length > 0
                  ? 'Fix claim scanner blockers first'
                  : preflight.length > 0
                    ? preflight[0]?.message
                    : isFinalStage
                      ? 'Complete Final sign-off'
                      : 'Sign off this stage'
            }
          >
            {pending ? 'Saving…' : isFinalStage ? 'Final sign-off' : 'Sign off stage'}
          </button>
        </div>
      </div>
    </div>
  )
}
