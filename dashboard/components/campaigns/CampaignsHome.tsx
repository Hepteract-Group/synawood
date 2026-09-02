'use client'

import { useEffect, useId, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'
import { CampaignModelPicker } from '@/components/campaigns/CampaignModelPicker'
import { resolveClientProductId } from '@/lib/resolve-client-product-id'
import { DEFAULT_CAMPAIGN_MODEL_PROFILE_ID } from '@synawood/creative/model-profiles'

const ASPECTS = [
  { id: '1:1', label: '1:1', hint: 'Square' },
  { id: '4:5', label: '4:5', hint: 'Portrait' },
  { id: '9:16', label: '9:16', hint: 'Story' },
] as const

type AspectId = (typeof ASPECTS)[number]['id']

type ProjectSummary = {
  id: string
  compositionId: string
  status: string
  headline: string
}

type CatalogItemOption = {
  id: string
  name: string
  summary: string
  claimBounds: string[]
}

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

export const CampaignsHome = () => {
  const router = useRouter()
  const [productId, setProductId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const briefId = useId()
  const countId = useId()
  const catalogId = useId()
  const [aspect, setAspect] = useState<AspectId>('1:1')
  const [count, setCount] = useState(3)
  const [recent, setRecent] = useState<ProjectSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)
  const [modelProfileId, setModelProfileId] = useState<string>(DEFAULT_CAMPAIGN_MODEL_PROFILE_ID)
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([])
  const [catalogItemId, setCatalogItemId] = useState('')

  const refresh = (activeProductId: string) => {
    startTransition(async () => {
      const response = await fetch(
        `/api/studio/projects?productId=${encodeURIComponent(activeProductId)}`,
      )
      const body = (await response.json()) as { projects?: ProjectSummary[]; error?: string }
      if (!response.ok) {
        setError(body.error ?? 'Could not load packs')
        return
      }
      setRecent(
        (body.projects ?? []).filter((project) => project.compositionId === 'campaign-pack-still'),
      )
    })
  }

  useEffect(() => {
    const id = resolveClientProductId()
    setProductId(id)
    if (!id) {
      setError('Create or join a Product first.')
      return
    }
    refresh(id)
    startTransition(async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(id)}/catalog`)
      const body = (await response.json().catch(() => null)) as {
        catalog?: { items?: CatalogItemOption[] }
      } | null
      setCatalogItems(body?.catalog?.items ?? [])
    })
  }, [])

  const createPack = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Write a short brief before creating a pack.')
      return
    }
    if (!productId) {
      setError('Create or join a Product first.')
      return
    }
    startTransition(async () => {
      setError(null)
      setBanner('Creating pack…')
      const createResponse = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          compositionId: 'campaign-pack-still',
          name: trimmed.slice(0, 80),
          modelProfileId,
        }),
      })
      const created = (await createResponse.json()) as {
        project?: { id: string; revision?: number }
        error?: string
      }
      if (!createResponse.ok || !created.project) {
        setBanner(null)
        setError(created.error ?? 'Could not create pack')
        return
      }

      const projectId = created.project.id
      let revision = created.project.revision ?? 1

      const brandResponse = await fetch(`/api/studio/projects/${projectId}/brand`, {
        method: 'POST',
      })
      if (brandResponse.ok) {
        const brandBody = (await brandResponse.json()) as { project?: { revision?: number } }
        revision = brandBody.project?.revision ?? revision
      }
      // Missing brand kit is OK — generate attaches a fallback brand (#463/#465).

      const selected = catalogItems.find((row) => row.id === catalogItemId)
      const briefPrompt = selected
        ? [trimmed, selected.summary, selected.claimBounds.join('\n')]
            .map((part) => part.trim())
            .filter(Boolean)
            .join('\n\n')
        : trimmed

      const briefResponse = await fetch(`/api/studio/projects/${projectId}/campaign/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: revision,
          prompt: briefPrompt,
          aspect,
          productId,
          suggestionSource: selected ? 'catalog' : 'manual',
        }),
      })
      const briefBody = (await briefResponse.json()) as {
        revision?: number
        error?: string
      }
      if (!briefResponse.ok) {
        setBanner(null)
        setError(briefBody.error ?? 'Pack created but brief failed to save')
        router.push(`/campaigns/${projectId}`)
        return
      }
      revision = briefBody.revision ?? revision

      setBanner('Generating stills…')
      const generateResponse = await fetch(`/api/studio/projects/${projectId}/campaign/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: revision,
          count,
          confirmSpend: true,
        }),
      })
      if (!generateResponse.ok) {
        const genBody = (await generateResponse.json().catch(() => ({}))) as { error?: string }
        setBanner(null)
        setError(
          genBody.error ??
            'Pack created, but stills did not generate. Open the pack, select cards, and use Generate stills.',
        )
        router.push(`/campaigns/${projectId}`)
        return
      }

      setBanner(null)
      router.push(`/campaigns/${projectId}`)
    })
  }

  const bumpCount = (delta: number) => {
    setCount((current) => Math.min(12, Math.max(1, current + delta)))
  }

  return (
    <section className="panel campaigns-home mos-enter">
      <div className="campaigns-home-stage">
        <header className="campaigns-home-header">
          <p className="eyebrow">Campaigns</p>
          <h1 className="campaigns-home-title">Still packs</h1>
          <p className="page-lede">Write a brief. Get a pack of stills.</p>
        </header>

        {banner ? (
          <div className="campaigns-banner" role="status" aria-live="polite">
            {banner}
          </div>
        ) : null}

        {error ? (
          <p className="error campaigns-home-error" role="alert">
            {error}{' '}
            {!productId ? (
              <Link href="/products" className="products-inline-link">
                Open Products
              </Link>
            ) : null}
          </p>
        ) : null}

        <form className="campaigns-composer" onSubmit={createPack} aria-busy={pending}>
          <label className="campaigns-field" htmlFor={briefId}>
            <span>Brief</span>
            <textarea
              id={briefId}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Calm focus for people drowning in PDFs. Soft desk light, no logos."
              disabled={pending || !productId}
            />
          </label>

          <div className="campaigns-composer-row">
            <fieldset className="campaigns-field campaigns-aspect">
              <legend>Format</legend>
              <div className="campaigns-aspect-tabs">
                {ASPECTS.map((option) => {
                  const selected = aspect === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      className={selected ? 'is-active' : undefined}
                      disabled={pending}
                      onClick={() => setAspect(option.id)}
                    >
                      <span>{option.label}</span>
                      <span className="campaigns-aspect-hint">{option.hint}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="campaigns-field campaigns-count">
              <span id={countId}>Creatives</span>
              <div className="campaigns-count-stepper">
                <button
                  type="button"
                  className="campaigns-count-btn"
                  disabled={pending || count <= 1}
                  aria-label="Fewer creatives"
                  onClick={() => bumpCount(-1)}
                >
                  −
                </button>
                <span className="campaigns-count-value" aria-labelledby={countId}>
                  {count}
                </span>
                <button
                  type="button"
                  className="campaigns-count-btn"
                  disabled={pending || count >= 12}
                  aria-label="More creatives"
                  onClick={() => bumpCount(1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <details className="campaigns-more">
            <summary>Model and catalog</summary>
            <div className="campaigns-more-body">
              <CampaignModelPicker
                value={modelProfileId}
                disabled={pending}
                onChange={setModelProfileId}
              />
              <label className="campaigns-field" htmlFor={catalogId}>
                <span>Catalog item</span>
                <select
                  id={catalogId}
                  value={catalogItemId}
                  onChange={(event) => setCatalogItemId(event.target.value)}
                  disabled={pending || !productId}
                >
                  <option value="">Prompt only</option>
                  {catalogItems.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted campaigns-dna-note">
                A catalog item adds claim bounds. It is not Media bin footage.
              </p>
            </div>
          </details>

          <button
            type="submit"
            className="btn btn-primary campaigns-composer-submit"
            disabled={pending || !productId}
          >
            {pending ? 'Working…' : 'Create pack'}
          </button>
        </form>

        <section className="campaigns-recent" aria-labelledby="campaigns-recent-title">
          <h2 id="campaigns-recent-title" className="campaigns-section-title">
            Recent packs
          </h2>
          {recent.length === 0 ? (
            <p className="muted">No packs yet. The first one you create shows up here.</p>
          ) : (
            <ul className="campaigns-recent-list">
              {recent.map((pack) => (
                <li key={pack.id} className="campaigns-recent-row">
                  <Link href={`/campaigns/${pack.id}`} className="campaigns-recent-link">
                    <strong>{pack.headline}</strong>
                    <span className="campaigns-status">{statusLabel(pack.status)}</span>
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost campaigns-recent-delete"
                    disabled={pending}
                    onClick={() => setDeleteTarget(pack)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete campaign pack?"
        body={
          deleteTarget
            ? `“${deleteTarget.headline || 'Untitled pack'}” and its stills/motion will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete pack"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget
          if (!target || !productId) return
          setDeleteTarget(null)
          startTransition(async () => {
            setError(null)
            setBanner('Deleting pack…')
            const response = await fetch(`/api/studio/projects/${target.id}`, {
              method: 'DELETE',
            })
            if (!response.ok && response.status !== 204) {
              const body = (await response.json().catch(() => ({}))) as { error?: string }
              setBanner(null)
              setError(body.error ?? 'Could not delete pack')
              return
            }
            setBanner(null)
            refresh(productId)
          })
        }}
      />
    </section>
  )
}
