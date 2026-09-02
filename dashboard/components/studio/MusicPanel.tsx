'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { assetContentUrl } from './AssetLibrary'
import { AudioPreviewPlayer } from './AudioPreviewPlayer'
import { ConfirmDialog } from './ConfirmDialog'
import { generationJobStatus } from '@/lib/generation-job-status'
import { humanizeStudioError } from '@/lib/humanize-studio-error'
import {
  displayMusicBedTitle,
  formatMusicEstimateLabel,
  interpretMusicJobRecovery,
  musicBedLicenseLabel,
  type MusicBannerTone,
} from '@/lib/music-bed-display'

type MusicGenerationRow = {
  id: string
  assetId: string | null
  prompt: string | null
  licenseStatus: string
  commercialUseAllowed: boolean
  provider: string
  durationMs: number | null
  createdAt: string
  inputSnapshot?: Record<string, unknown>
}

type MusicPanelProps = {
  projectId: string
  revision: number
  confirmSpend: boolean
  onConfirmSpendChange: (value: boolean) => void
  open: boolean
  onClose: () => void
  /** Must reload project (and await) so revision advances before the next generate. */
  onGenerated: () => void | Promise<void>
}

const pendingKey = (projectId: string) => `mos-music-pending:${projectId}`

const providerLabel = (provider: string): string => {
  if (provider === 'elevenlabs') return 'ElevenLabs'
  if (provider === 'mock') return 'Mock'
  return provider
}

export const MusicPanel = ({
  projectId,
  revision,
  confirmSpend,
  onConfirmSpendChange,
  open,
  onClose,
  onGenerated,
}: MusicPanelProps) => {
  const [prompt, setPrompt] = useState('calm instrumental lo-fi bed under voiceover')
  const [durationSeconds, setDurationSeconds] = useState(30)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimateGbp, setEstimateGbp] = useState<number | null>(null)
  const [estimateStub, setEstimateStub] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<MusicBannerTone>(null)
  const [rows, setRows] = useState<MusicGenerationRow[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [localRevision, setLocalRevision] = useState(revision)
  const [playingToken, setPlayingToken] = useState<string | null>(null)
  const rowsRef = useRef<MusicGenerationRow[]>([])
  rowsRef.current = rows

  useEffect(() => {
    setLocalRevision(revision)
  }, [revision])

  const loadList = useCallback(async (): Promise<MusicGenerationRow[]> => {
    const res = await fetch(`/api/studio/projects/${projectId}/music`, {
      credentials: 'same-origin',
    })
    const data = (await res.json().catch(() => ({}))) as {
      generations?: MusicGenerationRow[]
      error?: string
    }
    if (!res.ok) {
      setError(humanizeStudioError(data.error ?? 'Failed to load music beds'))
      return rowsRef.current
    }
    setError(null)
    const next = data.generations ?? []
    setRows(next)
    return next
  }, [projectId])

  useEffect(() => {
    if (!open && !pending) return
    void loadList()
  }, [open, pending, loadList])

  // Reload recovery: sessionStorage may hold a prior tab's job id. Read nested
  // `job.status` (GET /api/studio/generation/[id]); never scare if beds already landed.
  useEffect(() => {
    let cancelled = false
    let pollTimer: number | undefined

    const finishPending = () => {
      try {
        sessionStorage.removeItem(pendingKey(projectId))
      } catch {
        /* ignore storage */
      }
    }

    const verify = async () => {
      let raw: string | null = null
      try {
        raw = sessionStorage.getItem(pendingKey(projectId))
      } catch {
        return
      }
      if (!raw) return

      let parsed: { jobId?: string } = {}
      try {
        parsed = JSON.parse(raw) as { jobId?: string }
      } catch {
        finishPending()
        return
      }

      const listed = await loadList()
      if (cancelled) return
      const bedsAlreadyListed = listed.length > 0 || rowsRef.current.length > 0

      if (!parsed.jobId) {
        if (bedsAlreadyListed) {
          finishPending()
          return
        }
        setBannerTone('warn')
        setBanner('A music generation may still be running — check Recent beds or regenerate.')
        return
      }

      const applyOutcome = (outcome: ReturnType<typeof interpretMusicJobRecovery>) => {
        if (outcome.clearPending) finishPending()
        setBannerTone(outcome.bannerTone)
        setBanner(outcome.banner)
      }

      const runOnce = async (): Promise<'again' | 'done'> => {
        try {
          const res = await fetch(`/api/studio/generation/${parsed.jobId}`, {
            credentials: 'same-origin',
          })
          const data = await res.json().catch(() => ({}))
          if (cancelled) return 'done'
          const outcome = interpretMusicJobRecovery({
            status: generationJobStatus(data),
            bedsAlreadyListed,
          })
          applyOutcome(outcome)
          if (outcome.kind === 'silent') return 'done'
          if (outcome.reload) {
            await onGenerated()
            await loadList()
          }
          return outcome.kind === 'in_progress' ? 'again' : 'done'
        } catch {
          if (cancelled) return 'done'
          applyOutcome(
            interpretMusicJobRecovery({
              status: undefined,
              bedsAlreadyListed,
            }),
          )
          return 'done'
        }
      }

      const first = await runOnce()
      if (first === 'again' && !cancelled) {
        const tick = async () => {
          const next = await runOnce()
          if (next === 'again' && !cancelled) {
            pollTimer = window.setTimeout(() => void tick(), 2000)
          }
        }
        pollTimer = window.setTimeout(() => void tick(), 2000)
      }
    }

    void verify()
    return () => {
      cancelled = true
      if (pollTimer != null) window.clearTimeout(pollTimer)
    }
  }, [projectId, loadList, onGenerated])

  const refreshEstimate = useCallback(async () => {
    const res = await fetch(`/api/studio/projects/${projectId}/music`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: localRevision,
        prompt,
        durationSeconds,
        estimateOnly: true,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      estimatedGbp?: number
      stub?: boolean
      error?: string
    }
    if (!res.ok) {
      setError(humanizeStudioError(data.error ?? 'Estimate failed'))
      return null
    }
    setEstimateGbp(typeof data.estimatedGbp === 'number' ? data.estimatedGbp : null)
    setEstimateStub(data.stub === true)
    return data.estimatedGbp ?? 0
  }, [projectId, localRevision, prompt, durationSeconds])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void refreshEstimate()
    }, 300)
    return () => window.clearTimeout(handle)
  }, [open, refreshEstimate])

  const runGenerate = async (spendConfirmed: boolean) => {
    setPending(true)
    setError(null)
    setBannerTone(null)
    setBanner('Generating music bed…')
    try {
      sessionStorage.setItem(pendingKey(projectId), JSON.stringify({ startedAt: Date.now() }))
      const res = await fetch(`/api/studio/projects/${projectId}/music`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: localRevision,
          prompt,
          durationSeconds,
          forceInstrumental: true,
          confirmSpend: spendConfirmed,
          placeOnTimeline: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        jobId?: string
        assetId?: string
        estimatedGbp?: number
        revision?: number
      }
      if (!res.ok) {
        if (res.status === 409) {
          await onGenerated()
        }
        throw new Error(data.error ?? 'Music generation failed')
      }
      if (typeof data.revision === 'number') {
        setLocalRevision(data.revision)
      }
      if (data.jobId) {
        sessionStorage.setItem(
          pendingKey(projectId),
          JSON.stringify({ jobId: data.jobId, startedAt: Date.now() }),
        )
      }
      setBannerTone('ok')
      setBanner('Music bed ready — play it under Recent beds. Also placed on the audio track.')
      await onGenerated()
      await loadList()
      sessionStorage.removeItem(pendingKey(projectId))
    } catch (err) {
      setBanner(null)
      setBannerTone(null)
      sessionStorage.removeItem(pendingKey(projectId))
      setError(humanizeStudioError(err instanceof Error ? err.message : 'Music generation failed'))
    } finally {
      setPending(false)
    }
  }

  const onGenerateClick = async () => {
    const estimated = (await refreshEstimate()) ?? estimateGbp ?? 0
    if (estimated > 0 && !confirmSpend) {
      setConfirmOpen(true)
      return
    }
    await runGenerate(confirmSpend || estimated === 0)
  }

  const onDuck = async () => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/music/duck`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: localRevision }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        project?: { revision?: number }
        summary?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not duck music under speech')
      }
      if (typeof data.project?.revision === 'number') {
        setLocalRevision(data.project.revision)
      }
      setBannerTone('ok')
      setBanner(data.summary ?? 'Music now ducks under speech. Play the cut to hear it.')
      await onGenerated()
    } catch (err) {
      setError(humanizeStudioError(err instanceof Error ? err.message : 'Could not duck music'))
    } finally {
      setPending(false)
    }
  }

  const tryClose = () => {
    if (pending) return
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pending, onClose])

  if (!open) {
    if (banner || pending) {
      return (
        <div className="music-progress-banner" role="status">
          <span>{pending ? 'Generating music bed…' : banner}</span>
          {!pending ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBanner(null)}>
              Dismiss
            </button>
          ) : null}
        </div>
      )
    }
    return null
  }

  return (
    <>
      <div className="music-panel-backdrop" onClick={tryClose} aria-hidden />
      <div
        className="music-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="music-panel-title"
      >
        <header className="music-panel-header">
          <div>
            <p className="eyebrow">Audio</p>
            <h2 id="music-panel-title">Music bed</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={tryClose}
            disabled={pending}
          >
            Minimize
          </button>
        </header>
        <p className="music-panel-lede">
          Live ElevenLabs instrumental bed. Confirm spend when prompted. Mock beds (CI only) cannot
          be Approved as Final.
        </p>
        <label className="music-field">
          <span>Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            disabled={pending}
          />
        </label>
        <label className="music-field">
          <span>Duration (seconds)</span>
          <input
            type="number"
            min={3}
            max={120}
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(Number(event.target.value) || 30)}
            disabled={pending}
          />
        </label>
        <div className="music-estimate">
          Estimate:{' '}
          <strong>
            {formatMusicEstimateLabel({ estimatedGbp: estimateGbp, stub: estimateStub })}
          </strong>
        </div>
        <label className="music-confirm">
          <input
            type="checkbox"
            checked={confirmSpend}
            onChange={(event) => onConfirmSpendChange(event.target.checked)}
            disabled={pending}
          />
          Confirm spend for this generation
        </label>
        {error ? (
          <p className="music-error" role="alert">
            {error}
          </p>
        ) : null}
        {banner ? (
          <p className={`music-banner${bannerTone ? ` is-${bannerTone}` : ''}`} role="status">
            {banner}
          </p>
        ) : null}
        <div className="music-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onGenerateClick()}
            disabled={pending}
          >
            {pending ? 'Generating…' : 'Generate bed'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void onDuck()}
            disabled={pending}
          >
            Duck under speech
          </button>
        </div>
        <section className="music-history">
          <h3>Recent beds</h3>
          {rows.length === 0 ? (
            error ? null : (
              <p className="music-empty">
                No music generations yet. Generate a bed to preview it here.
              </p>
            )
          ) : (
            <ul>
              {rows.map((row) => {
                const title = displayMusicBedTitle(row.prompt, row.inputSnapshot)
                const durationLabel =
                  row.durationMs != null ? `${Math.round(row.durationMs / 1000)}s` : null
                return (
                  <li key={row.id} className="music-bed">
                    <div className="music-bed-copy">
                      <p className="music-bed-title">{title}</p>
                      <p className="music-bed-meta">
                        {durationLabel ? <span className="mono">{durationLabel}</span> : null}
                        {durationLabel ? ' · ' : null}
                        {providerLabel(row.provider)}
                        {' · '}
                        {musicBedLicenseLabel(row)}
                      </p>
                    </div>
                    {row.assetId ? (
                      <AudioPreviewPlayer
                        src={assetContentUrl(projectId, row.assetId)}
                        label={title}
                        playingToken={playingToken}
                        onPlayingToken={setPlayingToken}
                      />
                    ) : (
                      <p className="music-bed-missing muted">No audio file on this row.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm music spend"
        body={
          estimateGbp != null
            ? `This bed is estimated at ~£${estimateGbp.toFixed(2)}. Confirm to call ElevenLabs Music.`
            : 'Confirm spend to generate a live music bed.'
        }
        confirmLabel="Generate"
        danger={false}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          onConfirmSpendChange(true)
          void runGenerate(true)
        }}
      />
    </>
  )
}
