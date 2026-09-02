'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  COMPOSITION_DISPLAY,
  COMPOSITION_IDS,
  FORMAT_COMPOSITION_IDS,
  type CompositionId,
} from '@synawood/creative/project/client'
import { ProductSwitcher } from '../../../components/ProductSwitcher'
import { newProjectLandsIn, studioEmptyStateLine } from '../../../lib/product-scope-copy'
import { useActiveProduct } from '../../../lib/use-active-product'
import { useBillingSummary } from '../../../lib/use-billing-summary'
import { buildProjectTree } from '../../../lib/project-tree'
import { StudioLinkMenu } from '../../../components/studio/StudioLinkMenu'

type ProjectSummary = {
  id: string
  productId: string
  compositionId: string
  status: string
  revision: number
  clipCount: number
  assetCount: number
  durationSeconds: number
  headline: string
  parentProjectId?: string | null
  variantLabel?: string | null
}

const compositionLabel = (compositionId: string): string => {
  if ((COMPOSITION_IDS as readonly string[]).includes(compositionId)) {
    return COMPOSITION_DISPLAY[compositionId as CompositionId].label
  }
  return compositionId
}

const TRIAL_DEFAULT_COMPOSITION: CompositionId = 'talking-head-60'

const statusLabel = (status: string): string => {
  switch (status) {
    case 'drafting':
      return 'Draft'
    case 'rendering':
      return 'Exporting'
    case 'needs_review':
      return 'Needs review'
    case 'approved':
      return 'Approved'
    case 'killed':
      return 'Discarded'
    default:
      return status
  }
}

export const StudioHome = () => {
  const router = useRouter()
  const { productId, productName, products, loading, selectProduct } = useActiveProduct()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const billing = useBillingSummary(projects.length === 0 ? productId : null)
  const trialEmpty = billing.billingEnabled && !billing.loading && billing.planId === 'trial'
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [compositionId, setCompositionId] = useState<CompositionId>('talking-head-60')
  const [createSource, setCreateSource] = useState<'blank' | 'extract'>('blank')
  const [extractUrl, setExtractUrl] = useState('')
  const [extractSource, setExtractSource] = useState<'url' | 'pdf'>('url')
  const [formError, setFormError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const nameRef = useRef<HTMLInputElement | null>(null)
  const renameRef = useRef<HTMLInputElement | null>(null)

  const projectTree = buildProjectTree(projects)

  const refresh = useCallback((activeProductId: string) => {
    startTransition(async () => {
      setListError(null)
      const response = await fetch(
        `/api/studio/projects?productId=${encodeURIComponent(activeProductId)}`,
      )
      const body = (await response.json()) as { projects?: ProjectSummary[]; error?: string }
      if (!response.ok) {
        setListError(body.error ?? 'Failed to load projects')
        return
      }
      setProjects(body.projects ?? [])
    })
  }, [])

  useEffect(() => {
    if (loading) return
    if (!productId) {
      setListError('Create or join a Product first.')
      setProjects([])
      return
    }
    refresh(productId)
  }, [productId, refresh, loading])

  useEffect(() => {
    if (!createOpen) return
    nameRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) closeCreate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [createOpen, pending])

  useEffect(() => {
    if (!renameTarget) return
    renameRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) closeRename()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [renameTarget, pending])

  useEffect(() => {
    if (!deleteTarget) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) closeDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteTarget, pending])

  const openCreate = () => {
    setName('')
    setCompositionId('talking-head-60')
    setCreateSource('blank')
    setExtractUrl('')
    setExtractSource('url')
    setFormError(null)
    setCreateOpen(true)
  }

  const closeCreate = () => {
    if (pending) return
    setCreateOpen(false)
    setName('')
    setCompositionId('talking-head-60')
    setCreateSource('blank')
    setExtractUrl('')
    setExtractSource('url')
    setFormError(null)
  }

  const openRename = (project: ProjectSummary, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setRenameTarget(project)
    setRenameName(project.headline)
    setRenameError(null)
  }

  const closeRename = () => {
    if (pending) return
    setRenameTarget(null)
    setRenameName('')
    setRenameError(null)
  }

  const openDelete = (project: ProjectSummary, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDeleteTarget(project)
    setDeleteError(null)
  }

  const closeDelete = () => {
    if (pending) return
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const createProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Name is required')
      return
    }
    if (!productId) {
      setFormError('Create or join a Product first.')
      return
    }
    startTransition(async () => {
      setFormError(null)
      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          compositionId,
          name: trimmed,
        }),
      })
      const body = (await response.json()) as { project?: { id: string }; error?: string }
      if (!response.ok || !body.project) {
        setFormError(body.error ?? 'Failed to create project')
        return
      }
      setCreateOpen(false)
      setName('')
      setCompositionId('talking-head-60')
      setCreateSource('blank')
      setExtractUrl('')
      const params = new URLSearchParams()
      if (createSource === 'extract') {
        params.set('wizard', 'ad-generator')
        params.set('extractSource', extractSource)
        const urlValue = extractUrl.trim()
        if (extractSource === 'url' && urlValue) params.set('extractUrl', urlValue)
      }
      const query = params.toString()
      router.push(query ? `/studio/${body.project.id}?${query}` : `/studio/${body.project.id}`)
    })
  }

  const createAndNavigate = (opts: {
    compositionId: CompositionId
    name: string
    query?: string
  }) => {
    if (!productId) {
      setListError('Create or join a Product first.')
      return
    }
    startTransition(async () => {
      setListError(null)
      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          compositionId: opts.compositionId,
          name: opts.name,
        }),
      })
      const body = (await response.json()) as { project?: { id: string }; error?: string }
      if (!response.ok || !body.project) {
        setListError(body.error ?? 'Failed to create project')
        return
      }
      const url = opts.query
        ? `/studio/${body.project.id}?${opts.query}`
        : `/studio/${body.project.id}`
      router.push(url)
    })
  }

  const createUploadTake = () =>
    createAndNavigate({
      compositionId: TRIAL_DEFAULT_COMPOSITION,
      name: 'Talking-head take',
      query: 'upload=1',
    })

  const createFromStills = () =>
    createAndNavigate({
      compositionId: TRIAL_DEFAULT_COMPOSITION,
      name: 'Stills cut',
    })

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!renameTarget) return
    const trimmed = renameName.trim()
    if (!trimmed) {
      setRenameError('Name is required')
      return
    }
    startTransition(async () => {
      setRenameError(null)
      const response = await fetch(`/api/studio/projects/${renameTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        summary?: { headline?: string }
        error?: string
      }
      if (!response.ok) {
        setRenameError(body.error ?? 'Failed to rename project')
        return
      }
      setProjects((prev) =>
        prev.map((item) =>
          item.id === renameTarget.id
            ? { ...item, headline: body.summary?.headline ?? trimmed }
            : item,
        ),
      )
      setRenameTarget(null)
      setRenameName('')
      if (productId) refresh(productId)
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      setDeleteError(null)
      const response = await fetch(`/api/studio/projects/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!response.ok && response.status !== 204) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setDeleteError(body.error ?? 'Failed to delete project')
        return
      }
      const deletedId = deleteTarget.id
      setDeleteTarget(null)
      setProjects((prev) => prev.filter((item) => item.id !== deletedId))
      if (productId) refresh(productId)
    })
  }

  return (
    <section className="panel studio-home mos-enter">
      <header className="studio-home-header">
        <div className="studio-home-header-copy">
          <p className="eyebrow">Studio</p>
          <h1 className="studio-home-title">Creative Studio</h1>
          <p className="page-lede">
            Turn a brief into a cut you can preview, refine, and export — without hiring an editor.
          </p>
        </div>
        <div className="studio-home-actions">
          <ProductSwitcher productId={productId} products={products} onChange={selectProduct} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
            disabled={pending || !productId}
          >
            New project
          </button>
        </div>
      </header>
      {productName ? <p className="studio-home-scope">{newProjectLandsIn(productName)}</p> : null}

      {listError ? (
        <p className="error">
          {listError}{' '}
          <Link href="/products" className="products-inline-link">
            Open Products
          </Link>
        </p>
      ) : null}

      {!listError && projects.length === 0 ? (
        <div className="studio-empty">
          {trialEmpty ? (
            <>
              <h2 className="studio-empty-title">Upload a take</h2>
              <p className="page-lede">
                Most teams Approve the first ad from a talking-head clip. You can add stills and
                captions after.
              </p>
              <div className="studio-empty-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createUploadTake}
                  disabled={pending || !productId}
                >
                  Upload video
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={createFromStills}
                  disabled={pending || !productId}
                >
                  Start from stills
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="studio-empty-title">No projects yet</h2>
              <p className="page-lede">{studioEmptyStateLine(productName)}</p>
              <div className="studio-empty-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreate}
                  disabled={pending || !productId}
                >
                  New project
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {projects.length > 0 ? (
        <ul className="studio-project-grid mos-stagger">
          {projectTree.map(({ project, versions }) => {
            const mark = (project.headline.trim().charAt(0) || '?').toUpperCase()
            return (
              <li key={project.id} className="studio-project-card">
                <span className="studio-status-pill">{statusLabel(project.status)}</span>
                <a
                  href={`/studio/${project.id}`}
                  className="studio-project-link"
                  aria-label={`Open main cut: ${project.headline}`}
                >
                  <span className="studio-project-mark" aria-hidden>
                    {mark}
                  </span>
                  <div className="studio-project-body">
                    <span className="studio-project-kind">Main cut</span>
                    <strong className="studio-project-name">{project.headline}</strong>
                    <span className="studio-project-meta">
                      {compositionLabel(project.compositionId)}
                    </span>
                  </div>
                  <span className="studio-project-open-hint">Open main cut →</span>
                </a>
                <div className="studio-project-actions">
                  {versions.length > 0 ? (
                    <StudioLinkMenu
                      ariaLabel={`Ad versions of ${project.headline}`}
                      triggerLabel={`${versions.length} ad version${versions.length === 1 ? '' : 's'}`}
                      options={versions.map((version) => ({
                        id: version.id,
                        label: version.variantLabel ?? version.headline,
                        meta: statusLabel(version.status),
                        href: `/studio/${version.id}`,
                      }))}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={pending}
                    onClick={(event) => openRename(project, event)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost project-list-delete"
                    disabled={pending}
                    onClick={(event) => openDelete(project, event)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {createOpen
        ? createPortal(
            <div
              className="dialog-root create-project-root"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-project-title"
            >
              <button
                type="button"
                className="dialog-backdrop"
                onClick={closeCreate}
                aria-label="Cancel"
                disabled={pending}
              />
              <div className="dialog-panel create-project-panel">
                <h3 id="create-project-title" className="dialog-title">
                  Create Project
                </h3>
                <p className="dialog-body">
                  {newProjectLandsIn(productName)} Give this cut a name, pick a format, and choose a
                  blank start or a URL/PDF extract.
                </p>
                <form className="create-project-form" onSubmit={createProject}>
                  <label className="create-project-field">
                    <span>Name</span>
                    <input
                      ref={nameRef}
                      type="text"
                      name="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Hook — week 30"
                      maxLength={80}
                      required
                      disabled={pending}
                      autoComplete="off"
                    />
                  </label>
                  <fieldset className="create-project-formats" disabled={pending}>
                    <legend>Format</legend>
                    <div
                      className="create-project-format-list"
                      role="radiogroup"
                      aria-label="Format"
                    >
                      {FORMAT_COMPOSITION_IDS.map((id) => {
                        const display = COMPOSITION_DISPLAY[id]
                        const selected = compositionId === id
                        return (
                          <label
                            key={id}
                            className={`create-project-format-card${selected ? ' is-selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="compositionId"
                              value={id}
                              checked={selected}
                              onChange={() => setCompositionId(id)}
                            />
                            <span className="create-project-format-label">{display.label}</span>
                            <span className="create-project-format-desc muted">
                              {display.description}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="create-project-formats" disabled={pending}>
                    <legend>Start from</legend>
                    <div
                      className="create-project-format-list is-source"
                      role="radiogroup"
                      aria-label="Start from"
                    >
                      <label
                        className={`create-project-format-card${createSource === 'blank' ? ' is-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="createSource"
                          value="blank"
                          checked={createSource === 'blank'}
                          onChange={() => setCreateSource('blank')}
                        />
                        <span className="create-project-format-label">Blank</span>
                        <span className="create-project-format-desc muted">
                          Empty timeline or Player. Direct in chat.
                        </span>
                      </label>
                      <label
                        className={`create-project-format-card${createSource === 'extract' ? ' is-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="createSource"
                          value="extract"
                          checked={createSource === 'extract'}
                          onChange={() => setCreateSource('extract')}
                        />
                        <span className="create-project-format-label">URL or PDF</span>
                        <span className="create-project-format-desc muted">
                          Extract a brief, then apply a first cut.
                        </span>
                      </label>
                    </div>
                  </fieldset>
                  {createSource === 'extract' ? (
                    <div className="create-project-extract">
                      <div
                        className="create-project-extract-tabs"
                        role="tablist"
                        aria-label="Source type"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={extractSource === 'url'}
                          className={`create-project-extract-tab${extractSource === 'url' ? ' is-selected' : ''}`}
                          onClick={() => setExtractSource('url')}
                        >
                          URL
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={extractSource === 'pdf'}
                          className={`create-project-extract-tab${extractSource === 'pdf' ? ' is-selected' : ''}`}
                          onClick={() => setExtractSource('pdf')}
                        >
                          PDF
                        </button>
                      </div>
                      {extractSource === 'url' ? (
                        <label className="create-project-field">
                          <span>Product URL</span>
                          <input
                            type="url"
                            value={extractUrl}
                            onChange={(event) => setExtractUrl(event.target.value)}
                            placeholder="https://…"
                            disabled={pending}
                          />
                        </label>
                      ) : (
                        <p className="create-project-extract-hint muted">
                          Save opens the extract wizard so you can upload the PDF.
                        </p>
                      )}
                    </div>
                  ) : null}
                  {formError ? <p className="error">{formError}</p> : null}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={closeCreate}
                      disabled={pending}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={pending || !name.trim()}
                    >
                      {pending ? 'Saving…' : createSource === 'extract' ? 'Continue' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {renameTarget ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-project-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={closeRename}
            aria-label="Cancel"
            disabled={pending}
          />
          <div className="dialog-panel create-project-panel">
            <h3 id="rename-project-title" className="dialog-title">
              Rename project
            </h3>
            <form className="create-project-form" onSubmit={submitRename}>
              <label className="create-project-field">
                <span>Name</span>
                <input
                  ref={renameRef}
                  type="text"
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                  maxLength={80}
                  required
                  disabled={pending}
                  autoComplete="off"
                />
              </label>
              {renameError ? <p className="error">{renameError}</p> : null}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeRename}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={pending || !renameName.trim()}
                >
                  {pending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={closeDelete}
            aria-label="Cancel"
            disabled={pending}
          />
          <div className="dialog-panel create-project-panel">
            <h3 id="delete-project-title" className="dialog-title">
              Delete project
            </h3>
            <p className="dialog-body">
              Delete <strong>{deleteTarget.headline}</strong> permanently? This cannot be undone.
            </p>
            {deleteError ? <p className="error">{deleteError}</p> : null}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeDelete}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary project-list-delete-confirm"
                onClick={confirmDelete}
                disabled={pending}
              >
                {pending ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
