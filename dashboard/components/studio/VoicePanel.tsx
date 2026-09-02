'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'

type VoiceMode = 'synth' | 'dub' | 'fillers'

type VoiceClip = { id: string; kind: 'audio' | 'video'; label: string }

type VoiceProfileOption = { id: string; name: string; kind: 'synth' | 'clone' }

type CutRange = { from: number; durationInFrames: number }

type VoicePanelProps = {
  projectId: string
  revision: number
  confirmSpend: boolean
  onConfirmSpendChange: (value: boolean) => void
  open: boolean
  onClose: () => void
  onGenerated: () => void | Promise<void>
}

const pendingKey = (projectId: string) => `mos-voice-pending:${projectId}`

export const VoicePanel = ({
  projectId,
  revision,
  confirmSpend,
  onConfirmSpendChange,
  open,
  onClose,
  onGenerated,
}: VoicePanelProps) => {
  const lineId = useId()
  const localeId = useId()
  const clipIdField = useId()
  const profileFieldId = useId()
  const spendId = useId()
  const [mode, setMode] = useState<VoiceMode>('synth')
  const [text, setText] = useState('Edit PDFs in your browser. No Adobe headache.')
  const [targetLocale, setTargetLocale] = useState('fr')
  const [clipId, setClipId] = useState('')
  const [clips, setClips] = useState<VoiceClip[]>([])
  const [profiles, setProfiles] = useState<VoiceProfileOption[]>([])
  const [profileId, setProfileId] = useState('')
  const [cuts, setCuts] = useState<CutRange[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [estimateGbp, setEstimateGbp] = useState<number | null>(null)
  const onGeneratedRef = useRef(onGenerated)
  onGeneratedRef.current = onGenerated

  const loadStatus = useCallback(async () => {
    const response = await fetch(`/api/studio/projects/${projectId}/voice`, {
      credentials: 'same-origin',
    })
    const body = (await response.json().catch(() => null)) as {
      pendingJobs?: Array<{ id: string; status: string }>
      clips?: VoiceClip[]
      profiles?: VoiceProfileOption[]
      defaultProfileId?: string | null
      error?: string
    } | null
    if (!response.ok) return { pendingJobs: [] as Array<{ id: string }> }
    const nextClips = body?.clips ?? []
    const nextProfiles = body?.profiles ?? []
    setClips(nextClips)
    setProfiles(nextProfiles)
    setClipId((current) => current || nextClips[0]?.id || '')
    setProfileId((current) => {
      if (current && nextProfiles.some((row) => row.id === current)) return current
      return body?.defaultProfileId ?? nextProfiles[0]?.id ?? ''
    })
    return { pendingJobs: body?.pendingJobs ?? [] }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    const recover = async () => {
      const { pendingJobs } = await loadStatus()
      if (cancelled) return
      if (pendingJobs.length > 0) {
        setPending(true)
        setBanner('Synthesizing voice…')
        return
      }
      let raw: string | null = null
      try {
        raw = sessionStorage.getItem(pendingKey(projectId))
      } catch {
        raw = null
      }
      if (!raw) return
      try {
        sessionStorage.removeItem(pendingKey(projectId))
      } catch {
        /* ignore */
      }
      await onGeneratedRef.current()
      setPending(false)
      setBanner(null)
    }
    void recover()
    return () => {
      cancelled = true
    }
  }, [projectId, loadStatus])

  useEffect(() => {
    if (!open) return
    void loadStatus()
  }, [open, loadStatus])

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => {
      void (async () => {
        const { pendingJobs } = await loadStatus()
        if (pendingJobs.length > 0) return
        try {
          sessionStorage.removeItem(pendingKey(projectId))
        } catch {
          /* ignore */
        }
        setPending(false)
        setBanner('Voice clip ready. Check the Audio tab for the provenance badge.')
        await onGeneratedRef.current()
      })()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [pending, loadStatus, projectId])

  useEffect(() => {
    if (!open || mode === 'fillers') return
    const handle = window.setTimeout(() => {
      void (async () => {
        const response = await fetch(`/api/studio/projects/${projectId}/voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: revision,
            action: 'estimate',
            text,
            estimateRole:
              profiles.find((row) => row.id === profileId)?.kind === 'clone'
                ? 'clone'
                : mode === 'dub'
                  ? 'dub'
                  : 'synth',
          }),
        })
        const body = (await response.json().catch(() => null)) as { estimatedGbp?: number } | null
        if (response.ok) setEstimateGbp(body?.estimatedGbp ?? null)
      })()
    }, 300)
    return () => window.clearTimeout(handle)
  }, [open, projectId, revision, text, mode, profileId, profiles])

  const runAction = (action: 'synthesize' | 'dub' | 'fillers' | 'apply_cuts', extra: object) => {
    setPending(true)
    setError(null)
    setBanner(
      action === 'fillers'
        ? 'Scanning fillers…'
        : action === 'apply_cuts'
          ? 'Applying cuts…'
          : action === 'dub'
            ? 'Dubbing line…'
            : 'Synthesizing voice…',
    )
    try {
      sessionStorage.setItem(pendingKey(projectId), JSON.stringify({ startedAt: Date.now() }))
    } catch {
      /* ignore */
    }
    void (async () => {
      const response = await fetch(`/api/studio/projects/${projectId}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: revision,
          action,
          confirmSpend,
          ...extra,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        jobId?: string
        cuts?: CutRange[]
        summary?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Voice Studio action failed.')
      if (body?.jobId) {
        try {
          sessionStorage.setItem(
            pendingKey(projectId),
            JSON.stringify({ jobId: body.jobId, startedAt: Date.now() }),
          )
        } catch {
          /* ignore */
        }
      }
      if (action === 'fillers') {
        setCuts(body?.cuts ?? [])
        setBanner(body?.summary ?? 'Filler scan complete.')
        setPending(false)
        try {
          sessionStorage.removeItem(pendingKey(projectId))
        } catch {
          /* ignore */
        }
        return
      }
      await onGenerated()
      setCuts([])
      setBanner(
        action === 'apply_cuts'
          ? 'Cuts applied on the timeline.'
          : 'Voice clip ready. Check the Audio tab for the provenance badge.',
      )
      try {
        sessionStorage.removeItem(pendingKey(projectId))
      } catch {
        /* ignore */
      }
    })()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Voice Studio action failed.')
        setBanner(null)
        try {
          sessionStorage.removeItem(pendingKey(projectId))
        } catch {
          /* ignore */
        }
      })
      .finally(() => setPending(false))
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'fillers') {
      runAction('fillers', { clipId })
      return
    }
    if (mode === 'dub') {
      runAction('dub', { text, targetLocale, profileId: profileId || undefined })
      return
    }
    runAction('synthesize', { text, profileId: profileId || undefined })
  }

  const busyBanner = pending ? (banner ?? 'Working on voice…') : banner

  if (!open) {
    if (busyBanner || pending) {
      return (
        <div className="music-progress-banner" role="status" aria-live="polite">
          <span>{pending ? (banner ?? 'Synthesizing voice…') : busyBanner}</span>
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

  const audioClips = clips.filter((clip) => clip.kind === 'audio')

  return (
    <div
      className="dialog-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-panel-title"
    >
      <button
        type="button"
        className="dialog-backdrop"
        onClick={onClose}
        aria-label="Minimize Voice Studio"
      />
      <div className="dialog-panel music-panel">
        <header className="music-panel-header">
          <div>
            <p className="eyebrow">Audio</p>
            <h2 id="voice-panel-title">Voice Studio</h2>
          </div>
          <div className="music-panel-header-actions">
            <Link href="/settings/voice" className="btn btn-ghost btn-sm">
              Voice profiles
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Minimize
            </button>
          </div>
        </header>
        {banner ? (
          <div className="settings-alert" role="status" aria-live="polite">
            <p>{banner}</p>
          </div>
        ) : null}
        {error ? (
          <div className="settings-alert is-error" role="alert">
            <p>{error}</p>
          </div>
        ) : null}
        <p className="music-panel-lede">
          Synthesize or dub a line in the selected voice, or cut filler words after transcribe.
          Lip-sync is mock and cannot Approve.
        </p>
        <div className="packs-tabs" role="tablist" aria-label="Voice Studio mode">
          {(['synth', 'dub', 'fillers'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              className={mode === item ? 'packs-tab is-active' : 'packs-tab'}
              onClick={() => setMode(item)}
              disabled={pending}
            >
              {item === 'synth' ? 'Synthesize' : item === 'dub' ? 'Dub' : 'Fillers'}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="auth-form">
          {mode !== 'fillers' ? (
            <label htmlFor={profileFieldId}>
              Voice
              <select
                id={profileFieldId}
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                disabled={pending || profiles.length === 0}
              >
                {profiles.length === 0 ? (
                  <option value="">No profiles — create one in Settings → Voice</option>
                ) : (
                  profiles.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} ({row.kind === 'clone' ? 'Clone' : 'Synth'})
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}
          {mode !== 'fillers' && profiles.length === 0 ? (
            <p className="muted">
              Without a clone, this uses Gateway TTS. Open Settings → Voice, record a sample, then
              come back.
            </p>
          ) : null}
          {mode !== 'fillers' ? (
            <label htmlFor={lineId}>
              Line
              <textarea
                id={lineId}
                rows={4}
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={pending}
              />
            </label>
          ) : null}
          {mode === 'dub' ? (
            <label htmlFor={localeId}>
              Target language / locale
              <input
                id={localeId}
                value={targetLocale}
                onChange={(event) => setTargetLocale(event.target.value)}
                disabled={pending}
              />
            </label>
          ) : null}
          {mode === 'fillers' ? (
            <>
              <p className="muted">
                Fillers scan a transcribed clip. They do not clone. Synthesize with your voice
                first, Transcribe that clip, then scan.
              </p>
              <label htmlFor={clipIdField}>
                Clip
                <select
                  id={clipIdField}
                  value={clipId}
                  onChange={(event) => setClipId(event.target.value)}
                  disabled={pending || audioClips.length === 0}
                >
                  {audioClips.length === 0 ? (
                    <option value="">Synthesize, then Transcribe an audio clip first</option>
                  ) : (
                    audioClips.map((clip) => (
                      <option key={clip.id} value={clip.id}>
                        {clip.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </>
          ) : null}
          {mode !== 'fillers' ? (
            <p className="muted">
              Estimate: {estimateGbp == null ? '…' : `£${estimateGbp.toFixed(3)}`}
            </p>
          ) : null}
          {mode !== 'fillers' ? (
            <label htmlFor={spendId} className="auth-form-check">
              <input
                id={spendId}
                type="checkbox"
                checked={confirmSpend}
                onChange={(event) => onConfirmSpendChange(event.target.checked)}
                disabled={pending}
              />
              <span>Confirm spend</span>
            </label>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || (mode === 'fillers' && !clipId)}
          >
            {mode === 'synth' ? 'Synthesize' : mode === 'dub' ? 'Dub line' : 'Find fillers'}
          </button>
          {mode === 'fillers' && cuts.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => runAction('apply_cuts', { clipId, cuts })}
            >
              Apply {cuts.length} cut{cuts.length === 1 ? '' : 's'}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  )
}
