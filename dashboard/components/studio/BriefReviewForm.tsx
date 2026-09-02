'use client'

// Client-safe: `@synawood/creative/brief` barrel pulls apply-brief → node:crypto.
import { lowConfidenceFields, type ExtractedBrief } from '@synawood/creative/brief/extracted-brief'
import type { CSSProperties, ReactNode } from 'react'
import { assetContentUrl, type GalleryAsset } from './AssetLibrary'

type BriefReviewFormProps = {
  brief: ExtractedBrief
  onChange: (next: ExtractedBrief) => void
  disabled?: boolean
  projectId: string
  projectRevision: number
  assets: GalleryAsset[]
  onProjectChanged: () => void
}

const listToText = (items: string[]): string => items.join('\n')
const textToList = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/** Normalize LLM hex for `<input type="color">` (needs #rrggbb). */
const colorPickerValue = (raw: string | undefined, fallback: string): string => {
  const value = (raw ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  if (/^[0-9a-fA-F]{6}$/.test(value)) return `#${value}`
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, a, b, c] = value
    return `#${a}${a}${b}${b}${c}${c}`
  }
  return fallback
}

const Field = ({
  label,
  hint,
  low,
  wide,
  children,
}: {
  label: string
  hint?: string
  low?: boolean
  wide?: boolean
  children: ReactNode
}) => (
  <label
    className={`brief-review-field${low ? ' is-low-confidence' : ''}${wide ? ' is-wide' : ''}`}
  >
    <span className="brief-review-label">
      {label}
      {low ? <span className="brief-review-flag">Check this</span> : null}
    </span>
    {children}
    {low ? (
      <span className="brief-review-hint">We weren’t sure about this — check before applying.</span>
    ) : hint ? (
      <span className="brief-review-hint muted">{hint}</span>
    ) : null}
  </label>
)

const ColorField = ({
  label,
  value,
  fallback,
  low,
  disabled,
  onChange,
}: {
  label: string
  value: string | undefined
  fallback: string
  low?: boolean
  disabled?: boolean
  onChange: (next: string) => void
}) => {
  const picker = colorPickerValue(value, fallback)
  const text = value?.trim() ?? ''

  return (
    <div className={`brief-review-field brief-review-color${low ? ' is-low-confidence' : ''}`}>
      <span className="brief-review-label">
        {label}
        {low ? <span className="brief-review-flag">Check this</span> : null}
      </span>
      <div className="brief-review-color-row">
        <input
          type="color"
          className="brief-review-color-picker"
          aria-label={`${label} picker`}
          disabled={disabled}
          value={picker}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          className="brief-review-color-hex"
          spellCheck={false}
          disabled={disabled}
          placeholder={fallback}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
        <span
          className="brief-review-color-swatch"
          style={{ background: colorPickerValue(text || undefined, fallback) }}
          aria-hidden
        />
      </div>
      {low ? (
        <span className="brief-review-hint">
          We weren’t sure about this — check before applying.
        </span>
      ) : (
        <span className="brief-review-hint muted">Pick a color or edit the hex.</span>
      )}
    </div>
  )
}

export const BriefReviewForm = ({
  brief,
  onChange,
  disabled,
  projectId,
  projectRevision,
  assets,
  onProjectChanged,
}: BriefReviewFormProps) => {
  const low = new Set(lowConfidenceFields(brief))
  const primary = brief.brandCandidates.primaryColor
  const accent = brief.brandCandidates.accentColor
  const logoAssetId = brief.brandCandidates.logoAssetId
  const logoUrl = logoAssetId ? assetContentUrl(projectId, logoAssetId) : undefined
  const imageAssets = assets.filter(
    (asset) => asset.kind === 'image' || asset.contentType?.startsWith('image/'),
  )

  const patchBrand = (patch: Partial<ExtractedBrief['brandCandidates']>) =>
    onChange({
      ...brief,
      brandCandidates: { ...brief.brandCandidates, ...patch },
    })

  const patchProduct = (patch: Partial<ExtractedBrief['product']>) =>
    onChange({
      ...brief,
      product: { ...brief.product, ...patch },
    })

  const patchMessaging = (patch: Partial<ExtractedBrief['messaging']>) =>
    onChange({
      ...brief,
      messaging: { ...brief.messaging, ...patch },
    })

  const uploadLogo = (file: File | null) => {
    if (!file || disabled) return
    void (async () => {
      const form = new FormData()
      form.set('file', file)
      form.set('expectedRevision', String(projectRevision))
      form.set('role', 'primary')
      const response = await fetch(`/api/studio/projects/${projectId}/brand/logo`, {
        method: 'POST',
        body: form,
      })
      const body = (await response.json()) as {
        asset?: { id: string }
        error?: string
      }
      if (!response.ok || !body.asset) {
        return
      }
      patchBrand({ logoAssetId: body.asset.id })
      onProjectChanged()
    })()
  }

  return (
    <div className="brief-review-form">
      <div
        className="brief-review-palette"
        style={
          {
            '--brief-primary': colorPickerValue(primary, '#2980b9'),
            '--brief-accent': colorPickerValue(accent, '#fbbf24'),
          } as CSSProperties
        }
        aria-hidden
      />

      <section className="brief-review-section" aria-labelledby="brief-brand">
        <div className="brief-review-section-head">
          <h3 id="brief-brand">Brand</h3>
          <p className="muted">
            Name, logo, CTA, and colors that will seed Path C chrome. Edits auto-save.
          </p>
        </div>
        <div
          className={`brief-review-field brief-review-logo${low.has('brandCandidates.logoAssetId') ? ' is-low-confidence' : ''}`}
        >
          <span className="brief-review-label">
            Logo
            {low.has('brandCandidates.logoAssetId') ? (
              <span className="brief-review-flag">Check this</span>
            ) : null}
          </span>
          <div className="brief-review-logo-row">
            <div className="brief-review-logo-preview" aria-hidden>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed asset content route
                <img src={logoUrl} alt="" />
              ) : (
                <span className="muted">No logo</span>
              )}
            </div>
            <div className="brief-review-logo-actions">
              <label className="btn btn-ghost btn-sm brief-review-logo-upload">
                {logoAssetId ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                  disabled={disabled}
                  hidden
                  onChange={(event) => {
                    uploadLogo(event.target.files?.[0] ?? null)
                    event.target.value = ''
                  }}
                />
              </label>
              {logoAssetId ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={disabled}
                  onClick={() => {
                    patchBrand({ logoAssetId: undefined })
                    void (async () => {
                      await fetch(`/api/studio/projects/${projectId}/brand`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          expectedRevision: projectRevision,
                          clearLogo: true,
                        }),
                      })
                      onProjectChanged()
                    })()
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          {imageAssets.length > 1 ? (
            <div
              className="brief-review-logo-picks"
              role="listbox"
              aria-label="Choose logo from assets"
            >
              {imageAssets.slice(0, 12).map((asset) => {
                const selected = asset.id === logoAssetId
                return (
                  <button
                    key={asset.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`brief-review-logo-pick${selected ? ' is-selected' : ''}`}
                    disabled={disabled}
                    title="Use this image as logo"
                    onClick={() => patchBrand({ logoAssetId: asset.id })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetContentUrl(projectId, asset.id)} alt="" />
                  </button>
                )
              })}
            </div>
          ) : null}
          {low.has('brandCandidates.logoAssetId') ? (
            <span className="brief-review-hint">
              We weren’t sure about this — check before applying.
            </span>
          ) : (
            <span className="brief-review-hint muted">
              Wrong extract? Replace here or in Brand Studio — it stays on the brief.
            </span>
          )}
        </div>
        <div className="brief-review-grid brief-review-grid-brand">
          <Field label="Display name" low={low.has('brandCandidates.displayName')}>
            <input
              type="text"
              disabled={disabled}
              value={brief.brandCandidates.displayName ?? ''}
              onChange={(event) => patchBrand({ displayName: event.target.value || undefined })}
            />
          </Field>
          <Field label="Default CTA" low={low.has('brandCandidates.defaultCta')}>
            <input
              type="text"
              disabled={disabled}
              value={brief.brandCandidates.defaultCta ?? ''}
              onChange={(event) => patchBrand({ defaultCta: event.target.value || undefined })}
            />
          </Field>
          <ColorField
            label="Primary color"
            value={primary}
            fallback="#2980b9"
            low={low.has('brandCandidates.primaryColor')}
            disabled={disabled}
            onChange={(next) => patchBrand({ primaryColor: next || undefined })}
          />
          <ColorField
            label="Accent color"
            value={accent}
            fallback="#fbbf24"
            low={low.has('brandCandidates.accentColor')}
            disabled={disabled}
            onChange={(next) => patchBrand({ accentColor: next || undefined })}
          />
        </div>
      </section>

      <section className="brief-review-section" aria-labelledby="brief-product">
        <div className="brief-review-section-head">
          <h3 id="brief-product">Product</h3>
          <p className="muted">
            What you sell — keep the one-liner sharp; benefits feed later cuts.
          </p>
        </div>
        <div className="brief-review-stack">
          <Field label="Name" low={low.has('product.name')}>
            <input
              type="text"
              disabled={disabled}
              value={brief.product.name ?? ''}
              onChange={(event) => patchProduct({ name: event.target.value || undefined })}
            />
          </Field>
          <Field
            label="One-liner"
            hint="Shown in extract summaries and helps frame the cut"
            low={low.has('product.oneLiner')}
            wide
          >
            <textarea
              rows={3}
              disabled={disabled}
              value={brief.product.oneLiner ?? ''}
              onChange={(event) => patchProduct({ oneLiner: event.target.value || undefined })}
            />
          </Field>
          <Field label="Benefits" hint="One per line" low={low.has('product.benefits')} wide>
            <textarea
              rows={6}
              disabled={disabled}
              value={listToText(brief.product.benefits)}
              onChange={(event) => patchProduct({ benefits: textToList(event.target.value) })}
            />
          </Field>
          <Field
            label="Pricing notes"
            hint="Optional — add what the page didn’t spell out"
            low={low.has('product.pricingNotes')}
            wide
          >
            <textarea
              rows={3}
              disabled={disabled}
              placeholder="e.g. Free trial · From £29/mo · Annual discount"
              value={brief.product.pricingNotes ?? ''}
              onChange={(event) => patchProduct({ pricingNotes: event.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="brief-review-section" aria-labelledby="brief-messaging">
        <div className="brief-review-section-head">
          <h3 id="brief-messaging">Messaging</h3>
          <p className="muted">
            Opening lines and CTAs become the axes when you create ad versions.
          </p>
        </div>
        <div className="brief-review-stack">
          <Field
            label="Opening lines (hooks)"
            hint="One per line"
            low={low.has('messaging.hookCandidates')}
            wide
          >
            <textarea
              rows={8}
              disabled={disabled}
              value={listToText(brief.messaging.hookCandidates)}
              onChange={(event) =>
                patchMessaging({ hookCandidates: textToList(event.target.value) })
              }
            />
          </Field>
          <Field
            label="Calls to action"
            hint="One per line"
            low={low.has('messaging.ctaCandidates')}
            wide
          >
            <textarea
              rows={5}
              disabled={disabled}
              value={listToText(brief.messaging.ctaCandidates)}
              onChange={(event) =>
                patchMessaging({ ctaCandidates: textToList(event.target.value) })
              }
            />
          </Field>
          <Field label="Tone" low={low.has('messaging.tone')} wide>
            <textarea
              rows={2}
              disabled={disabled}
              value={brief.messaging.tone ?? ''}
              onChange={(event) => patchMessaging({ tone: event.target.value || undefined })}
            />
          </Field>
        </div>
      </section>

      <p className="brief-review-confidence muted">
        Overall confidence: {Math.round((brief.confidence.overall ?? 0) * 100)}%
        {low.size > 0 ? ` · ${low.size} field${low.size === 1 ? '' : 's'} to double-check` : ''}
      </p>
    </div>
  )
}
