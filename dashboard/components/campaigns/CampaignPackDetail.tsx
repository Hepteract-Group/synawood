'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { StudioProject } from '@synawood/creative/project/schema'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'
import { CampaignModelPicker } from '@/components/campaigns/CampaignModelPicker'
import { ReviewBar, type ExportTargets } from '@/components/studio/ReviewBar'
import { humanizeStudioError } from '@/lib/humanize-studio-error'
import { DEFAULT_CAMPAIGN_MODEL_PROFILE_ID } from '@synawood/creative/model-profiles'

type Props = {
  projectId: string
}

const assetUrl = (projectId: string, assetId: string) =>
  `/api/studio/projects/${projectId}/assets/${assetId}/content`

export const CampaignPackDetail = ({ projectId }: Props) => {
  const router = useRouter()
  const [project, setProject] = useState<StudioProject | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [reviewPending, setReviewPending] = useState(false)
  const [renderActive, setRenderActive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRemoveSelected, setConfirmRemoveSelected] = useState(false)
  const [previewMode, setPreviewMode] = useState<Record<string, 'still' | 'motion'>>({})
  const [modelProfileId, setModelProfileId] = useState<string>(DEFAULT_CAMPAIGN_MODEL_PROFILE_ID)
  const [animateTarget, setAnimateTarget] = useState<{
    creativeId: string
    withoutText: boolean
    estimatedGbp?: number
  } | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/studio/projects/${projectId}`)
    const body = (await response.json()) as {
      project?: StudioProject
      error?: string
      row?: { modelProfileId?: string }
    }
    if (!response.ok || !body.project) {
      setError(humanizeStudioError(body.error ?? 'Could not load pack'))
      return
    }
    if (body.project.compositionId !== 'campaign-pack-still') {
      setError('This project is not a Campaign Pack. Open it in Studio instead.')
      setProject(body.project)
      return
    }
    setProject(body.project)
    if (body.row?.modelProfileId) {
      setModelProfileId(body.row.modelProfileId)
    }
    setError(null)
    const inflight = body.project.campaignPack?.creatives.find(
      (c) => c.motionJobId && !c.motionAssetId,
    )
    if (inflight?.motionJobId) {
      setBanner(`Animating ${inflight.id}…`)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!project) return
    const inflight = project.campaignPack?.creatives.find((c) => c.motionJobId && !c.motionAssetId)
    if (!inflight?.motionJobId) return
    let cancelled = false
    const poll = async () => {
      const response = await fetch(`/api/studio/generation/${inflight.motionJobId}`)
      if (!response.ok || cancelled) return
      const body = (await response.json()) as {
        job?: { status?: string; output_asset_id?: string | null }
      }
      if (body.job?.status === 'ready' || body.job?.status === 'failed') {
        setBanner(null)
        await load()
        return
      }
      window.setTimeout(() => {
        void poll()
      }, 2000)
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [project, load])

  const mutate = (mutation: Record<string, unknown>) => {
    if (!project) return
    startTransition(async () => {
      setError(null)
      const response = await fetch(`/api/studio/projects/${projectId}/mutations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: project.revision, mutation }),
      })
      const body = (await response.json()) as { project?: StudioProject; error?: string }
      if (!response.ok || !body.project) {
        setError(body.error ?? 'Edit failed')
        return
      }
      setProject(body.project)
    })
  }

  const openAnimate = (creativeId: string, withoutText: boolean) => {
    if (!project) return
    startTransition(async () => {
      setError(null)
      const response = await fetch(`/api/studio/projects/${projectId}/campaign/animate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: project.revision,
          creativeId,
          withoutText,
          estimateOnly: true,
        }),
      })
      const body = (await response.json()) as {
        estimatedGbp?: number
        error?: string
      }
      if (!response.ok) {
        setError(body.error ?? 'Could not estimate Animate')
        return
      }
      setAnimateTarget({
        creativeId,
        withoutText,
        estimatedGbp: body.estimatedGbp ?? 0,
      })
    })
  }

  const confirmAnimate = () => {
    if (!project || !animateTarget) return
    const target = animateTarget
    setAnimateTarget(null)
    startTransition(async () => {
      setBanner(`Animating ${target.creativeId}${target.withoutText ? ' (motion only)' : ''}…`)
      setError(null)
      const response = await fetch(`/api/studio/projects/${projectId}/campaign/animate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: project.revision,
          creativeId: target.creativeId,
          withoutText: target.withoutText,
          confirmSpend: true,
        }),
      })
      const body = (await response.json()) as {
        project?: StudioProject
        error?: string
        jobId?: string | null
      }
      if (!response.ok) {
        setBanner(null)
        setError(body.error ?? 'Animate failed')
        await load()
        return
      }
      if (body.project) setProject(body.project)
      else await load()
      if (!body.jobId) setBanner(null)
    })
  }

  const toggleSelect = (creativeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(creativeId)) next.delete(creativeId)
      else next.add(creativeId)
      return next
    })
  }

  const importBrand = () => {
    startTransition(async () => {
      setBanner('Importing brand…')
      setError(null)
      const response = await fetch(`/api/studio/projects/${projectId}/brand`, { method: 'POST' })
      const body = (await response.json()) as {
        project?: StudioProject
        error?: string
        warning?: string
        fallbackBrand?: boolean
      }
      setBanner(null)
      if (!response.ok) {
        await load()
        setError(body.error ?? 'Brand import failed')
        return
      }
      if (body.project) setProject(body.project)
      else await load()
      if (body.fallbackBrand && body.warning) {
        setBanner(`Using fallback brand (${body.warning}). You can Regenerate stills now.`)
      }
    })
  }

  const regenerateSelected = () => {
    if (!project || selected.size === 0) return
    const creativeIds = [...selected]
    const missingStills = creativeIds.some((id) => {
      const creative = project.campaignPack?.creatives.find((row) => row.id === id)
      return !creative?.backgroundAssetId
    })
    startTransition(async () => {
      setBanner(
        `${missingStills ? 'Generating' : 'Regenerating'} ${selected.size} creative${selected.size === 1 ? '' : 's'}…`,
      )
      setError(null)
      const response = await fetch(`/api/studio/projects/${projectId}/campaign/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: project.revision,
          creativeIds,
          count: creativeIds.length,
          confirmSpend: true,
        }),
      })
      const body = (await response.json()) as { project?: StudioProject; error?: string }
      setBanner(null)
      if (!response.ok) {
        // Reload pack state, then re-apply error — load() clears error on success (#461).
        await load()
        setError(body.error ?? 'Generate stills failed')
        return
      }
      if (body.project) setProject(body.project)
      else await load()
    })
  }

  const onExport = (_targets: ExportTargets) => {
    if (!project) return
    startTransition(async () => {
      setRenderActive(true)
      setBanner('Exporting stills…')
      setError(null)
      const response = await fetch(`/api/studio/projects/${projectId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: 'stills' }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setBanner(null)
        setRenderActive(false)
        setError(body.error ?? 'Export failed')
        return
      }
      // Poll project status briefly so Approve unlocks after needs_review.
      for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        await load()
        const status = (await fetch(`/api/studio/projects/${projectId}`).then((r) => r.json())) as {
          project?: StudioProject
        }
        if (status.project?.status === 'needs_review' || status.project?.status === 'approved') {
          setProject(status.project)
          break
        }
      }
      setBanner(null)
      setRenderActive(false)
    })
  }

  const onReview = (action: 'approve' | 'kill' | 'regenerate') => {
    if (!project) return
    if (action === 'approve' && selected.size === 0) {
      setError('Select at least one creative before Approve.')
      return
    }
    setReviewPending(true)
    startTransition(async () => {
      setError(null)
      const response = await fetch(`/api/studio/projects/${projectId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          expectedRevision: project.revision,
          selectedCreativeIds: [...selected],
        }),
      })
      const body = (await response.json()) as { project?: StudioProject; error?: string }
      setReviewPending(false)
      if (!response.ok || !body.project) {
        setError(body.error ?? 'Review action failed')
        return
      }
      setProject(body.project)
    })
  }

  const removeSelectedCreatives = () => {
    if (!project || selected.size === 0) return
    startTransition(async () => {
      setError(null)
      let revision = project.revision
      let nextProject = project
      for (const creativeId of selected) {
        const response = await fetch(`/api/studio/projects/${projectId}/mutations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: revision,
            mutation: { type: 'remove_campaign_creative', creativeId },
          }),
        })
        const body = (await response.json()) as { project?: StudioProject; error?: string }
        if (!response.ok || !body.project) {
          setError(body.error ?? 'Could not remove creative')
          if (body.project) setProject(body.project)
          return
        }
        nextProject = body.project
        revision = body.project.revision
      }
      setProject(nextProject)
      setSelected(new Set())
    })
  }

  if (!project && !error) {
    return (
      <section className="panel">
        <p className="muted">Loading pack…</p>
      </section>
    )
  }

  if (!project) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
        <Link href="/campaigns">Back to Campaigns</Link>
      </section>
    )
  }

  const creatives = [...(project.campaignPack?.creatives ?? [])].sort((a, b) => a.order - b.order)
  const selectedMissingStills =
    selected.size > 0 &&
    [...selected].some((id) => {
      const creative = creatives.find((row) => row.id === id)
      return !creative?.backgroundAssetId
    })

  return (
    <section className="panel campaigns-detail mos-enter">
      <header className="campaigns-detail-header">
        <div>
          <p className="eyebrow">
            <Link href="/campaigns" className="campaigns-back">
              Campaigns
            </Link>
          </p>
          <h1 className="campaigns-home-title">{project.name || 'Campaign pack'}</h1>
          <p className="page-lede">
            {project.campaignPack?.brief.prompt || 'No brief yet.'} ·{' '}
            {project.campaignPack?.brief.aspect ?? '1:1'}
          </p>
          <div className="campaigns-detail-models">
            <CampaignModelPicker
              value={modelProfileId}
              projectId={projectId}
              disabled={pending}
              onChange={setModelProfileId}
              onPersisted={setModelProfileId}
              onError={setError}
            />
          </div>
        </div>
        <div className="campaigns-detail-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            Delete pack
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => mutate({ type: 'add_campaign_creative', headline: '' })}
          >
            Add creative
          </button>
          <button
            type="button"
            className={selectedMissingStills ? 'btn btn-primary' : 'btn btn-ghost'}
            disabled={pending || selected.size === 0}
            onClick={regenerateSelected}
          >
            {selectedMissingStills ? 'Generate stills' : 'Regenerate selected'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending || selected.size === 0}
            onClick={() => setConfirmRemoveSelected(true)}
          >
            Remove selected
          </button>
          {!project.brand ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={importBrand}
            >
              Import brand
            </button>
          ) : null}
          <ReviewBar
            status={project.status}
            renderActive={renderActive}
            pending={pending}
            reviewPending={reviewPending}
            onExport={onExport}
            onReview={onReview}
            approveEnabled={
              selected.size > 0 &&
              [...selected].every((id) => {
                const creative = project.campaignPack?.creatives.find((row) => row.id === id)
                return Boolean(creative?.motionAssetId || creative?.backgroundAssetId)
              })
            }
          />
        </div>
      </header>

      {banner ? (
        <div className="campaigns-banner" role="status">
          {banner}
        </div>
      ) : null}
      {error ? (
        <p className="error campaigns-error" role="alert">
          {error}{' '}
          <button type="button" className="btn btn-ghost" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
      {selected.size > 0 ? (
        <p className="muted campaigns-selection-hint">
          {selected.size} selected. Use Remove selected to delete those cards (and their stills).
          The trash icon discards the whole pack, not the selection.
        </p>
      ) : (
        <p className="muted campaigns-selection-hint">
          Select creatives with stills (or motion) to Approve. Edit a headline inline without
          regenerating the pack.
        </p>
      )}

      <ul className="campaigns-creative-grid">
        {creatives.map((creative) => {
          const checked = selected.has(creative.id)
          const mode = previewMode[creative.id] ?? (creative.motionAssetId ? 'motion' : 'still')
          const showMotion = mode === 'motion' && Boolean(creative.motionAssetId)
          return (
            <li
              key={creative.id}
              className={`campaigns-creative-card${checked ? ' is-selected' : ''}`}
            >
              <label className="campaigns-creative-select">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelect(creative.id)}
                />
                <span className="sr-only">Select {creative.id}</span>
              </label>
              <div className="campaigns-creative-preview">
                {showMotion && creative.motionAssetId ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    key={creative.motionAssetId}
                    src={assetUrl(projectId, creative.motionAssetId)}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={`Motion for ${creative.headline || creative.id}`}
                  />
                ) : creative.backgroundAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(projectId, creative.backgroundAssetId)} alt="" />
                ) : (
                  <span className="muted">No still yet</span>
                )}
              </div>
              {creative.motionAssetId && creative.backgroundAssetId ? (
                <div className="campaigns-preview-toggle" role="group" aria-label="Preview mode">
                  <button
                    type="button"
                    className={`btn btn-ghost${mode === 'still' ? ' is-active' : ''}`}
                    disabled={pending}
                    onClick={() => setPreviewMode((prev) => ({ ...prev, [creative.id]: 'still' }))}
                  >
                    Still
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ghost${mode === 'motion' ? ' is-active' : ''}`}
                    disabled={pending}
                    onClick={() => setPreviewMode((prev) => ({ ...prev, [creative.id]: 'motion' }))}
                  >
                    Motion
                  </button>
                </div>
              ) : creative.motionAssetId ? (
                <span className="campaigns-motion-pill">Motion ready — play above</span>
              ) : null}
              <label className="campaigns-field">
                <span>Headline</span>
                <input
                  type="text"
                  defaultValue={creative.headline}
                  key={`${creative.id}-${creative.headline}`}
                  maxLength={120}
                  disabled={pending}
                  onBlur={(event) => {
                    const next = event.target.value.trim()
                    if (next === creative.headline) return
                    mutate({
                      type: 'set_campaign_creative',
                      creativeId: creative.id,
                      headline: next,
                    })
                  }}
                />
              </label>
              <div className="campaigns-creative-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending || !creative.backgroundAssetId}
                  onClick={() => openAnimate(creative.id, false)}
                >
                  Animate
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending || !creative.backgroundAssetId}
                  onClick={() => openAnimate(creative.id, true)}
                >
                  Animate without text
                </button>
                {creative.backgroundAssetId || creative.motionAssetId ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={pending}
                    onClick={() =>
                      mutate({
                        type: 'clear_campaign_creative_media',
                        creativeId: creative.id,
                      })
                    }
                  >
                    Clear still
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() => {
                    setSelected((prev) => {
                      const next = new Set(prev)
                      next.delete(creative.id)
                      return next
                    })
                    mutate({
                      type: 'remove_campaign_creative',
                      creativeId: creative.id,
                    })
                  }}
                >
                  Remove card
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {creatives.length === 0 ? (
        <p className="muted">No creatives yet. Add one or regenerate from the brief.</p>
      ) : null}

      <ConfirmDialog
        open={confirmRemoveSelected}
        title="Remove selected creatives?"
        body={`Remove ${selected.size} creative${selected.size === 1 ? '' : 's'} from this pack, including their stills and motion. This cannot be undone.`}
        confirmLabel="Remove selected"
        onCancel={() => setConfirmRemoveSelected(false)}
        onConfirm={() => {
          setConfirmRemoveSelected(false)
          removeSelectedCreatives()
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete campaign pack?"
        body={`“${project.name || 'Untitled pack'}” and its stills/motion will be removed. This cannot be undone.`}
        confirmLabel="Delete pack"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          startTransition(async () => {
            setError(null)
            setBanner('Deleting pack…')
            const response = await fetch(`/api/studio/projects/${projectId}`, {
              method: 'DELETE',
            })
            if (!response.ok && response.status !== 204) {
              const body = (await response.json().catch(() => ({}))) as { error?: string }
              setBanner(null)
              setError(body.error ?? 'Could not delete pack')
              return
            }
            router.push('/campaigns')
          })
        }}
      />

      {animateTarget ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="animate-confirm-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={() => setAnimateTarget(null)}
            aria-label="Cancel"
            disabled={pending}
          />
          <div className="dialog-panel create-project-panel">
            <h3 id="animate-confirm-title" className="dialog-title">
              Animate creative
            </h3>
            <p className="dialog-body">
              {animateTarget.withoutText
                ? 'Create a short motion clip from the still (camera move only, no baked text).'
                : 'Create a short motion clip from the still. Path C text stays in Remotion.'}
            </p>
            <p className="muted">
              Estimated £{(animateTarget.estimatedGbp ?? 0).toFixed(2)}. The clip is not a Final
              until you Export and Approve.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAnimateTarget(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmAnimate}
                disabled={pending}
              >
                {pending ? 'Starting…' : 'Confirm spend'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
