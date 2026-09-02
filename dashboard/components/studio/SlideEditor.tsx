'use client'

import type { StudioMutation, StudioProject } from '@synawood/creative/project/client'
import { useEffect, useState } from 'react'

type CandidateBackground = {
  assetId: string
  previewUrl: string
}

type SlideEditorProps = {
  project: StudioProject
  projectId: string
  slideId: string | null
  onMutate: (mutation: StudioMutation) => Promise<void>
  /** Reload project after a candidate is generated (asset added to project). */
  onProjectRefresh: () => Promise<void> | void
  disabled?: boolean
}

/** Active-slide Path C text editor + background preview/apply. */
export const SlideEditor = ({
  project,
  projectId,
  slideId,
  onMutate,
  onProjectRefresh,
  disabled = false,
}: SlideEditorProps) => {
  const slide = project.slideshow?.slides.find((item) => item.id === slideId) ?? null
  const [headline, setHeadline] = useState(slide?.headline ?? '')
  const [body, setBody] = useState(slide?.body ?? '')
  const [durationFrames, setDurationFrames] = useState(slide?.durationFrames ?? 90)
  const [transition, setTransition] = useState(slide?.transition ?? 'cut')
  const [pending, setPending] = useState(false)
  const [direction, setDirection] = useState('')
  const [generating, setGenerating] = useState(false)
  const [candidate, setCandidate] = useState<CandidateBackground | null>(null)
  const [bgError, setBgError] = useState<string | null>(null)

  useEffect(() => {
    setHeadline(slide?.headline ?? '')
    setBody(slide?.body ?? '')
    setDurationFrames(slide?.durationFrames ?? 90)
    setTransition(slide?.transition ?? 'cut')
    setCandidate(null)
    setBgError(null)
  }, [slide?.id, slide?.headline, slide?.body, slide?.durationFrames, slide?.transition])

  const slideIndex = slide
    ? [...(project.slideshow?.slides ?? [])]
        .sort((a, b) => a.order - b.order)
        .findIndex((item) => item.id === slide.id) + 1
    : 0

  if (!slide) {
    return (
      <div className="slide-editor slide-editor-empty">
        <h3 className="slide-editor-title">Edit slide</h3>
        <p className="muted slide-editor-hint">
          Select a slide to edit headline, body, duration, and background.
        </p>
      </div>
    )
  }

  const save = async () => {
    setPending(true)
    try {
      await onMutate({
        type: 'set_slide',
        slideId: slide.id,
        headline,
        body: body.trim() ? body : null,
        durationFrames,
        transition,
      })
    } finally {
      setPending(false)
    }
  }

  const generatePreview = async () => {
    setGenerating(true)
    setBgError(null)
    try {
      const response = await fetch(
        `/api/studio/projects/${projectId}/slides/${slide.id}/background`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: project.revision,
            headline: headline.trim() || slide.headline,
            direction: direction.trim() || undefined,
            apply: false,
          }),
        },
      )
      const bodyJson = (await response.json()) as {
        assetId?: string
        previewUrl?: string
        error?: string
      }
      if (!response.ok || !bodyJson.assetId || !bodyJson.previewUrl) {
        throw new Error(bodyJson.error ?? 'Background generation failed')
      }
      setCandidate({ assetId: bodyJson.assetId, previewUrl: bodyJson.previewUrl })
      await onProjectRefresh()
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Background generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const applyCandidate = async () => {
    if (!candidate) return
    setPending(true)
    setBgError(null)
    try {
      await onMutate({
        type: 'set_slide',
        slideId: slide.id,
        backgroundAssetId: candidate.assetId,
      })
      setCandidate(null)
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Failed to apply background')
    } finally {
      setPending(false)
    }
  }

  const dirty =
    headline !== slide.headline ||
    (body || '') !== (slide.body || '') ||
    durationFrames !== slide.durationFrames ||
    transition !== slide.transition

  const busy = disabled || pending || generating
  const hasBrand = Boolean(project.brand)

  return (
    <div className="slide-editor" aria-label="Slide editor">
      <header className="slide-editor-header">
        <h3 className="slide-editor-title">Edit slide {slideIndex}</h3>
        <p className="muted slide-editor-hint">Headline, body, duration, background</p>
      </header>
      <label className="slide-editor-field">
        <span>Headline</span>
        <input
          value={headline}
          disabled={busy}
          onChange={(event) => setHeadline(event.target.value)}
          maxLength={120}
        />
      </label>
      <label className="slide-editor-field">
        <span>Body</span>
        <textarea
          value={body}
          disabled={busy}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={240}
        />
      </label>
      <div className="slide-editor-row">
        <label className="slide-editor-field">
          <span>Duration (frames)</span>
          <input
            type="number"
            min={15}
            max={600}
            value={durationFrames}
            disabled={busy}
            onChange={(event) => setDurationFrames(Number(event.target.value) || 90)}
          />
        </label>
        <label className="slide-editor-field">
          <span>Transition</span>
          <select
            value={transition}
            disabled={busy}
            onChange={(event) => setTransition(event.target.value as 'cut' | 'fade' | 'kenBurns')}
          >
            <option value="cut">Cut</option>
            <option value="fade">Fade</option>
            <option value="kenBurns">Ken Burns</option>
          </select>
        </label>
      </div>
      <div className="slide-editor-actions">
        <button type="button" className="btn" disabled={busy || !dirty} onClick={() => void save()}>
          {pending ? 'Saving…' : 'Apply to slide'}
        </button>
      </div>

      <div className="slide-bg-panel" aria-label="Slide background">
        <p className="slide-bg-title">Background</p>
        <label className="slide-editor-field">
          <span>What should change?</span>
          <textarea
            value={direction}
            disabled={busy}
            onChange={(event) => setDirection(event.target.value)}
            rows={2}
            maxLength={400}
            placeholder="e.g. darker greens, less clutter, soft office light…"
          />
        </label>
        <div className="slide-editor-actions">
          <button
            type="button"
            className="btn"
            disabled={busy || !hasBrand}
            title={
              hasBrand
                ? 'Generate a candidate — preview before applying'
                : 'Set a brand in Brand Studio first'
            }
            onClick={() => void generatePreview()}
          >
            {generating ? 'Generating…' : candidate ? 'Regenerate preview' : 'Generate preview'}
          </button>
        </div>
        {!hasBrand ? (
          <p className="muted slide-bg-hint">
            Open Brand Studio (or import brand) before generating.
          </p>
        ) : null}
        {bgError ? <p className="error">{bgError}</p> : null}
        {candidate ? (
          <div className="slide-bg-candidate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={candidate.previewUrl}
              alt="Candidate slide background"
              className="slide-bg-preview"
            />
            <div className="slide-editor-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void applyCandidate()}
              >
                Apply to slide
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  setCandidate(null)
                  setBgError(null)
                }}
              >
                Discard
              </button>
            </div>
            <p className="muted slide-bg-hint">
              Preview only — slide stays unchanged until you apply.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
