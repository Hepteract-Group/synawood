'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'
import { readActiveProductIdFromDocument } from '../../../../lib/active-product-cookie'
import { SettingsLocalNav } from '../settings-local-nav'

const MIN_CLONE_SAMPLE_SECONDS = 8

type VoiceProfile = {
  id: string
  name: string
  kind: 'synth' | 'clone'
  locale: string
  consentAt: string | null
  sampleBlobKey?: string | null
  providerVoiceId?: string | null
}

const recorderMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

const sampleExtension = (mime: string): string => {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

const cloneReady = (row: VoiceProfile): boolean =>
  row.kind === 'clone' &&
  Boolean(row.consentAt) &&
  Boolean(row.sampleBlobKey?.trim()) &&
  Boolean(row.providerVoiceId?.trim())

export const VoiceSettingsPanel = () => {
  const nameId = useId()
  const kindId = useId()
  const localeId = useId()
  const consentId = useId()
  const fileId = useId()
  const [productId, setProductId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'synth' | 'clone'>('synth')
  const [locale, setLocale] = useState('en')
  const [consent, setConsent] = useState(false)
  const [sampleFile, setSampleFile] = useState<File | null>(null)
  const [sampleUrl, setSampleUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const adoptSample = useCallback((file: File | null) => {
    setSampleFile(file)
    setSampleUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return file ? URL.createObjectURL(file) : null
    })
  }, [])

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (timerRef.current != null) window.clearInterval(timerRef.current)
    }
  }, [])

  useEffect(
    () => () => {
      if (sampleUrl) URL.revokeObjectURL(sampleUrl)
    },
    [sampleUrl],
  )

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/voice/profiles`)
    const body = (await response.json().catch(() => null)) as {
      profiles?: VoiceProfile[]
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load voice profiles.')
    setProfiles(body?.profiles ?? [])
  }, [])

  useEffect(() => {
    const id = readActiveProductIdFromDocument()
    setProductId(id)
    if (!id) {
      setLoading(false)
      setError('Select or create a Product first.')
      return
    }
    void load(id)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load voice profiles.'),
      )
      .finally(() => setLoading(false))
  }, [load])

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  const startRecording = () => {
    setError(null)
    setNotice(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot record audio. Upload a file instead.')
      return
    }
    void (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = recorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const file = new File([blob], `voice-sample.${sampleExtension(type)}`, { type })
        adoptSample(file)
        setRecording(false)
        clearTimer()
        stopMic()
        recorderRef.current = null
      }
      recorderRef.current = recorder
      setRecordSeconds(0)
      setRecording(true)
      recorder.start(250)
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((value) => value + 1)
      }, 1000)
    })().catch((err) => {
      stopMic()
      setRecording(false)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start the microphone. Allow access, or upload a file instead.',
      )
    })
  }

  const onCreate = (event: FormEvent) => {
    event.preventDefault()
    if (!productId) return
    if (kind === 'clone' && !consent) {
      setError('Check the consent box before saving a clone profile.')
      return
    }
    if (kind === 'clone' && !sampleFile) {
      setError(
        'Clone this voice first. Record at least 8 seconds, or upload a sample, then save the profile.',
      )
      return
    }
    if (kind === 'clone' && recording) {
      setError('Stop the recording before saving.')
      return
    }
    setBusy(
      kind === 'clone'
        ? 'Cloning your voice… this can take a few seconds.'
        : 'Saving voice profile…',
    )
    setError(null)
    setNotice(null)
    void (async () => {
      const form = new FormData()
      form.set('name', name)
      form.set('kind', kind)
      form.set('locale', locale)
      form.set('consentRecorded', kind === 'clone' && consent ? 'true' : 'false')
      if (kind === 'clone' && sampleFile) form.set('file', sampleFile)
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/voice/profiles`,
        { method: 'POST', body: form },
      )
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not save profile.')
      setName('')
      setConsent(false)
      adoptSample(null)
      setRecordSeconds(0)
      setNotice(
        kind === 'clone'
          ? 'Clone saved. Open a Studio project → Audio → Voice Studio. Synthesize, Dub, and Fillers will use this voice.'
          : 'Voice profile saved. Open a Studio project, Audio tab, then Voice Studio to use it.',
      )
      await load(productId)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not save profile.'))
      .finally(() => setBusy(null))
  }

  const archiveProfile = (id: string) => {
    if (!productId) return
    setBusy('Archiving voice profile…')
    setError(null)
    setNotice(null)
    void (async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/voice/profiles/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not archive profile.')
      setNotice('Voice profile archived.')
      await load(productId)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not archive profile.'))
      .finally(() => setBusy(null))
  }

  const cloneSaveBlocked = kind === 'clone' && (!consent || !sampleFile || recording)

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Voice
          </p>
          <h1 className="settings-title">Voice profiles</h1>
          <p className="page-lede">
            Synth uses Gateway TTS. Clone records your voice (at least {MIN_CLONE_SAMPLE_SECONDS}{' '}
            seconds). Voice Studio Synthesize, Dub, and Fillers then use that profile.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
          <Link href="/studio" className="btn btn-primary">
            Open Studio
          </Link>
        </div>
      </header>
      <SettingsLocalNav />
      {!productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before managing voice profiles.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}
      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading voice profiles…
        </p>
      ) : null}
      {recording ? (
        <div className="settings-alert" role="status" aria-live="polite">
          <p>
            Recording your voice… {recordSeconds}s
            {recordSeconds < MIN_CLONE_SAMPLE_SECONDS
              ? ` — keep talking until at least ${MIN_CLONE_SAMPLE_SECONDS} seconds.`
              : ' — you can stop now.'}{' '}
            Speak naturally. A few sentences about anything is enough.
          </p>
        </div>
      ) : null}
      {busy ? (
        <div className="settings-alert" role="status" aria-live="polite">
          <p>{busy}</p>
        </div>
      ) : null}
      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="settings-alert is-ok" role="status">
          <p>{notice}</p>
        </div>
      ) : null}

      {productId && !loading ? (
        <>
          <h2 className="section-title">Active profiles</h2>
          <ul className="settings-row-list">
            {profiles.length === 0 ? (
              <li className="settings-empty-inline">
                <p>No voice profiles yet. Save a synth profile, or record a clone sample below.</p>
                <p className="page-lede">
                  Then open a project → Audio → Voice Studio. Synthesize and Dub will pick the clone
                  by default.
                </p>
              </li>
            ) : (
              profiles.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.name}</strong>
                    <p className="muted">
                      {row.kind === 'clone' ? 'Clone' : 'Synth'} · {row.locale}
                      {row.kind === 'clone'
                        ? cloneReady(row)
                          ? ' · ready for Voice Studio'
                          : ' · missing sample — record again'
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setArchiveId(row.id)}
                  >
                    Archive
                  </button>
                </li>
              ))
            )}
          </ul>

          <h2 className="section-title">Add a profile</h2>
          <form
            onSubmit={onCreate}
            className="auth-form members-invite-form"
            aria-busy={Boolean(busy) || recording}
          >
            <label htmlFor={nameId}>
              Name
              <input
                id={nameId}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Founder VO"
              />
            </label>
            <label htmlFor={kindId}>
              Kind
              <select
                id={kindId}
                value={kind}
                onChange={(event) => setKind(event.target.value as 'synth' | 'clone')}
              >
                <option value="synth">Synth (Gateway TTS)</option>
                <option value="clone">Clone (your voice — record or upload)</option>
              </select>
            </label>
            <label htmlFor={localeId}>
              Language / locale
              <input
                id={localeId}
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                placeholder="en"
              />
            </label>
            {kind === 'clone' ? (
              <>
                <div className="settings-alert" role="note">
                  <p>
                    Record at least {MIN_CLONE_SAMPLE_SECONDS} seconds of you speaking, or upload a
                    clean take. Without a sample, nothing is cloned and Voice Studio cannot use this
                    profile as your voice.
                  </p>
                </div>
                <div className="settings-header-actions">
                  {recording ? (
                    <button type="button" className="btn btn-primary" onClick={stopRecording}>
                      Stop recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={startRecording}
                      disabled={Boolean(busy)}
                    >
                      Record sample
                    </button>
                  )}
                </div>
                <label htmlFor={fileId}>
                  Or upload a sample
                  <input
                    id={fileId}
                    type="file"
                    accept="audio/*,video/webm,video/mp4"
                    disabled={recording || Boolean(busy)}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      adoptSample(file)
                      setRecordSeconds(0)
                    }}
                  />
                </label>
                {sampleFile ? (
                  <div>
                    <p className="muted">
                      Sample ready: {sampleFile.name}
                      {recordSeconds > 0 ? ` (${recordSeconds}s)` : ''}
                    </p>
                    {sampleUrl ? (
                      <audio controls src={sampleUrl} style={{ width: '100%', marginTop: 8 }} />
                    ) : null}
                  </div>
                ) : (
                  <p className="muted">No sample yet. Record or upload before saving a clone.</p>
                )}
                <label htmlFor={consentId} className="auth-form-check">
                  <input
                    id={consentId}
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  <span>I have consent to clone this voice</span>
                </label>
              </>
            ) : null}
            <button
              type="submit"
              className="auth-submit"
              disabled={Boolean(busy) || cloneSaveBlocked}
            >
              {kind === 'clone' ? 'Save clone' : 'Save profile'}
            </button>
            {kind === 'clone' && cloneSaveBlocked ? (
              <p className="muted">
                {!consent
                  ? 'Check consent, then save.'
                  : recording
                    ? 'Stop the recording, then save.'
                    : 'Record or upload a sample, then save.'}
              </p>
            ) : null}
          </form>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(archiveId)}
        title="Archive this voice profile?"
        body="The profile leaves the active list. Existing clips keep their provenance."
        confirmLabel="Archive"
        cancelLabel="Keep"
        onConfirm={() => {
          if (!archiveId) return
          const id = archiveId
          setArchiveId(null)
          archiveProfile(id)
        }}
        onCancel={() => setArchiveId(null)}
      />
    </section>
  )
}
