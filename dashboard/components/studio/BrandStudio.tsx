'use client'

import type { BrandChrome, StudioProject } from '@synawood/creative/project/client'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { assetContentUrl, type GalleryAsset } from './AssetLibrary'
import { ConfirmDialog } from './ConfirmDialog'
import { ExtractSourceBar } from './ExtractSourceBar'

const FONT_OPTIONS = [
  {
    value: 'Georgia, "Times New Roman", serif',
    label: 'Georgia',
    meta: 'Classic serif',
  },
  {
    value: 'ui-serif, Georgia, serif',
    label: 'UI Serif',
    meta: 'System serif',
  },
  {
    value: 'system-ui, sans-serif',
    label: 'System UI',
    meta: 'Native sans',
  },
  {
    value: '"IBM Plex Sans", system-ui, sans-serif',
    label: 'IBM Plex Sans',
    meta: 'Product sans',
  },
  {
    value: '"IBM Plex Mono", ui-monospace, monospace',
    label: 'IBM Plex Mono',
    meta: 'Monospace',
  },
] as const

const PLANES = [
  { id: 'identity', label: 'Identity', mark: 'Id', hint: 'Name & logo' },
  { id: 'palette', label: 'Palette', mark: 'Pa', hint: 'Colors' },
  { id: 'type', label: 'Type', mark: 'Ty', hint: 'Typography' },
  { id: 'messaging', label: 'Messaging', mark: 'Me', hint: 'CTA & mood' },
  { id: 'stills', label: 'Stills', mark: 'St', hint: 'Reference art' },
  { id: 'chrome', label: 'Chrome', mark: 'Ch', hint: 'Logo bug' },
] as const

const CORNER_OPTIONS: Array<{ value: BrandChrome['corner']; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
]

type PlaneId = (typeof PLANES)[number]['id']

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!match) return null
  const n = Number.parseInt(match[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const parseCssColor = (value: string): { r: number; g: number; b: number; a: number } | null => {
  const trimmed = value.trim()
  const hex = hexToRgb(trimmed)
  if (hex) return { ...hex, a: 1 }
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(trimmed)
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    }
  }
  return null
}

const toHex6 = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

const toRgba = (r: number, g: number, b: number, a: number): string =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(2))})`

const captionPickerHex = (captionBg: string): string => {
  const parsed = parseCssColor(captionBg)
  return parsed ? toHex6(parsed.r, parsed.g, parsed.b) : '#0f1410'
}

const captionAlpha = (captionBg: string): number => {
  const parsed = parseCssColor(captionBg)
  return parsed?.a ?? 0.78
}

type BrandStudioProps = {
  project: StudioProject & { assets: GalleryAsset[] }
  open: boolean
  onClose: () => void
  onChanged: () => void
  extractUrl?: string
  extractPending?: boolean
  reasonerModelId?: string | null
  reasonerSaving?: boolean
  onExtractUrlChange?: (value: string) => void
  onReasonerChange?: (reasonerModelId: string) => void
  onExtract?: () => void
  extractError?: string | null
}

export const BrandStudio = ({
  project,
  open,
  onClose,
  onChanged,
  extractUrl = '',
  extractPending = false,
  reasonerModelId,
  reasonerSaving,
  onExtractUrlChange,
  onReasonerChange,
  onExtract,
  extractError,
}: BrandStudioProps) => {
  const [plane, setPlane] = useState<PlaneId>('identity')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const [displayName, setDisplayName] = useState(project.brand?.displayName ?? '')
  const [primaryColor, setPrimaryColor] = useState(project.brand?.primaryColor ?? '#666666')
  const [accentColor, setAccentColor] = useState(project.brand?.accentColor ?? '#888888')
  const [captionBg, setCaptionBg] = useState(project.brand?.captionBg ?? 'rgba(15,20,16,0.78)')
  const [fontFamily, setFontFamily] = useState(project.brand?.fontFamily ?? FONT_OPTIONS[0].value)
  const [defaultCta, setDefaultCta] = useState(project.brand?.defaultCta ?? '')
  const [mood, setMood] = useState(project.brand?.mood ?? '')
  const [chrome, setChrome] = useState<BrandChrome>({
    corner: project.brand?.chrome?.corner ?? 'top-right',
    scale: project.brand?.chrome?.scale ?? 1,
    safeMargin: project.brand?.chrome?.safeMargin ?? 40,
  })

  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDisplayName(project.brand?.displayName ?? '')
    setPrimaryColor(project.brand?.primaryColor ?? '#666666')
    setAccentColor(project.brand?.accentColor ?? '#888888')
    setCaptionBg(project.brand?.captionBg ?? 'rgba(15,20,16,0.78)')
    setFontFamily(project.brand?.fontFamily ?? FONT_OPTIONS[0].value)
    setDefaultCta(project.brand?.defaultCta ?? '')
    setMood(project.brand?.mood ?? '')
    setChrome({
      corner: project.brand?.chrome?.corner ?? 'top-right',
      scale: project.brand?.chrome?.scale ?? 1,
      safeMargin: project.brand?.chrome?.safeMargin ?? 40,
    })
    setError(null)
    setStatus(null)
  }, [open, project.brand, project.revision])

  if (!open) return null

  const brand = project.brand
  const logoAsset = brand?.logoAssetId
    ? project.assets.find((asset) => asset.id === brand.logoAssetId)
    : undefined
  const logoUrl = logoAsset ? assetContentUrl(project.id, logoAsset.id) : undefined
  const stillIds =
    brand?.stillAssetIds && brand.stillAssetIds.length > 0
      ? brand.stillAssetIds
      : brand?.stillAssetId
        ? [brand.stillAssetId]
        : []
  const activePlane = PLANES.find((item) => item.id === plane) ?? PLANES[0]
  const previewName =
    displayName.trim() || project.name?.trim() || brand?.displayName?.trim() || 'Brand preview'

  const patchBrand = (body: Record<string, unknown>) => {
    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/studio/projects/${project.id}/brand`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: project.revision, ...body }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Failed to update brand')
        return
      }
      onChanged()
    })
  }

  const uploadLogo = (file: File | null, role: 'primary' | 'mono') => {
    if (!file) return
    setError(null)
    startTransition(async () => {
      const form = new FormData()
      form.set('file', file)
      form.set('expectedRevision', String(project.revision))
      form.set('role', role)
      const response = await fetch(`/api/studio/projects/${project.id}/brand/logo`, {
        method: 'POST',
        body: form,
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Logo upload failed')
        return
      }
      onChanged()
    })
  }

  const uploadStill = (file: File | null) => {
    if (!file) return
    setError(null)
    startTransition(async () => {
      const form = new FormData()
      form.set('file', file)
      form.set('expectedRevision', String(project.revision))
      form.set('makePrimary', stillIds.length === 0 ? 'true' : 'false')
      const response = await fetch(`/api/studio/projects/${project.id}/brand/stills`, {
        method: 'POST',
        body: form,
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Still upload failed')
        return
      }
      onChanged()
    })
  }

  const removeStill = (assetId: string) => {
    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/studio/projects/${project.id}/brand/stills/${assetId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: project.revision }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? 'Failed to remove still')
        return
      }
      onChanged()
    })
  }

  const importProduct = () => {
    setError(null)
    setStatus('Importing product brand…')
    startTransition(async () => {
      try {
        const response = await fetch(`/api/studio/projects/${project.id}/brand`, {
          method: 'POST',
        })
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          setStatus(null)
          setError(
            payload.error ??
              'Import failed. This Product may have no Brand Library yet — set logo and stills here, then try again.',
          )
          return
        }
        setStatus('Imported — updating project…')
        onChanged()
        onClose()
      } catch (err) {
        setStatus(null)
        setError(err instanceof Error ? err.message : 'Import failed')
      }
    })
  }

  const clearBrand = () => {
    setError(null)
    setStatus('Clearing brand…')
    startTransition(async () => {
      try {
        const response = await fetch(`/api/studio/projects/${project.id}/brand-kit`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision: project.revision }),
        })
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          setStatus(null)
          setError(payload.error ?? 'Failed to clear brand')
          return
        }
        setConfirmClear(false)
        setStatus(null)
        onChanged()
        onClose()
      } catch (err) {
        setStatus(null)
        setError(err instanceof Error ? err.message : 'Failed to clear brand')
      }
    })
  }

  return (
    <div
      className="dialog-root brand-studio-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-studio-title"
    >
      <button type="button" className="dialog-backdrop" aria-label="Close" onClick={onClose} />
      <div className="dialog-panel brand-studio-panel">
        <header className="brand-studio-header">
          <div className="brand-studio-header-copy">
            <p className="eyebrow">Brand Studio</p>
            <h2 id="brand-studio-title">{brand ? 'Edit project brand' : 'Set project brand'}</h2>
            <p className="brand-studio-header-lede">
              Shape the mark, palette, and Path C chrome that land on the export — preview updates
              as you edit.
            </p>
          </div>
          <div className="brand-studio-header-actions">
            {pending ? (
              <span className="brand-studio-saving" role="status" aria-live="polite">
                Saving…
              </span>
            ) : null}
            <Link href="/settings/brand" className="btn btn-ghost btn-sm">
              Brand DNA
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {error ? (
          <p className="form-error brand-studio-banner" role="alert">
            {error}
          </p>
        ) : null}
        {status && !error ? (
          <p className="brand-studio-banner brand-studio-banner-status" role="status">
            {status}
          </p>
        ) : null}

        <div className="brand-studio-layout">
          <nav className="brand-studio-planes" aria-label="Brand editing planes">
            {PLANES.map((item) => {
              const active = plane === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`brand-studio-plane${active ? ' is-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setPlane(item.id)}
                >
                  <span className="brand-studio-plane-mark" aria-hidden>
                    {item.mark}
                  </span>
                  <span className="brand-studio-plane-copy">
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="brand-studio-main">
            <aside className="brand-studio-preview" aria-label="Path C preview">
              <div className="brand-studio-preview-bezel">
                <div
                  className="brand-studio-preview-frame"
                  style={{
                    ['--brand-primary' as string]: primaryColor,
                    ['--brand-accent' as string]: accentColor,
                    ['--brand-caption' as string]: captionBg,
                    fontFamily,
                  }}
                >
                  <div className="brand-studio-preview-grain" aria-hidden />
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      className={`brand-studio-preview-logo is-${chrome.corner}`}
                      style={{
                        width: `${Math.round(48 * chrome.scale)}px`,
                        height: `${Math.round(48 * chrome.scale)}px`,
                        margin: `${chrome.safeMargin / 4}px`,
                      }}
                    />
                  ) : (
                    <span className={`brand-studio-preview-logo-missing is-${chrome.corner}`}>
                      No logo
                    </span>
                  )}
                  <div className="brand-studio-preview-center">
                    <p className="brand-studio-preview-name">{previewName}</p>
                    {mood.trim() ? (
                      <p className="brand-studio-preview-mood">{mood.trim()}</p>
                    ) : (
                      <p className="brand-studio-preview-mood is-placeholder">Mood signal</p>
                    )}
                  </div>
                  <div className="brand-studio-preview-swatches" aria-hidden>
                    <span style={{ background: primaryColor }} title="Primary" />
                    <span style={{ background: accentColor }} title="Accent" />
                  </div>
                  <p className="brand-studio-preview-cta">
                    {defaultCta.trim() || 'Your CTA appears here'}
                  </p>
                </div>
              </div>
              <p className="brand-studio-preview-hint">
                Live Path C preview — logo, CTA, and colors burn into exports. Mood steers Path A
                prompts only.
              </p>
            </aside>

            <div key={plane} className="brand-studio-plane-body">
              <header className="brand-studio-section-head">
                <p className="brand-studio-section-kicker">{activePlane.label}</p>
                <h3 className="brand-studio-section-title">
                  {plane === 'identity'
                    ? 'Who shows up on the cut'
                    : plane === 'palette'
                      ? 'Color that carries the brand'
                      : plane === 'type'
                        ? 'Type for captions and CTA'
                        : plane === 'messaging'
                          ? 'Words that close the loop'
                          : plane === 'stills'
                            ? 'Reference stills for generation'
                            : 'Logo bug on video exports'}
                </h3>
              </header>

              {plane === 'identity' ? (
                <section className="brand-studio-section">
                  {onExtract && onExtractUrlChange ? (
                    <div className="brand-studio-card">
                      <div className="brand-studio-card-head">
                        <h4>Extract from URL</h4>
                        <p>
                          Pull brand candidates and product hooks from a public page. Apply results
                          from the extract banner when ready.
                        </p>
                      </div>
                      <ExtractSourceBar
                        url={extractUrl}
                        pending={extractPending}
                        disabled={pending}
                        reasonerModelId={reasonerModelId}
                        reasonerSaving={reasonerSaving}
                        onUrlChange={onExtractUrlChange}
                        onReasonerChange={onReasonerChange}
                        onExtract={onExtract}
                        error={extractError}
                      />
                    </div>
                  ) : null}

                  <div className="brand-studio-card">
                    <div className="brand-studio-card-head">
                      <h4>Logo</h4>
                      <p>Primary mark for Path C. Optional mono variant for dark frames.</p>
                    </div>
                    <div className="brand-studio-logo-stage" data-guide="logo-upload">
                      <div className="brand-studio-logo-preview" aria-hidden>
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt="" />
                        ) : (
                          <span>Upload a mark</span>
                        )}
                      </div>
                      <div className="brand-studio-logo-row">
                        <label className="btn btn-secondary">
                          {logoUrl ? 'Replace primary' : 'Upload primary'}
                          <input
                            type="file"
                            accept="image/*,.svg"
                            hidden
                            onChange={(event) =>
                              uploadLogo(event.target.files?.[0] ?? null, 'primary')
                            }
                          />
                        </label>
                        <label className="btn btn-ghost">
                          Upload mono
                          <input
                            type="file"
                            accept="image/*,.svg"
                            hidden
                            onChange={(event) =>
                              uploadLogo(event.target.files?.[0] ?? null, 'mono')
                            }
                          />
                        </label>
                        {brand?.logoAssetId ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => patchBrand({ clearLogo: true })}
                          >
                            Clear primary
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <label className="brand-studio-field brand-studio-card">
                    <span className="brand-studio-field-label">Display name</span>
                    <span className="brand-studio-field-hint">
                      Shown in Studio and brand context.
                    </span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      onBlur={() => {
                        if (displayName.trim() && displayName !== (brand?.displayName ?? '')) {
                          patchBrand({ displayName: displayName.trim() })
                        }
                      }}
                      placeholder="Product or brand name"
                    />
                  </label>
                </section>
              ) : null}

              {plane === 'palette' ? (
                <section className="brand-studio-section">
                  <div className="brand-studio-color-grid">
                    <label className="brand-studio-color-card">
                      <span
                        className="brand-studio-color-swatch"
                        style={{ background: primaryColor }}
                      />
                      <span className="brand-studio-color-meta">
                        <strong>Primary</strong>
                        <span>CTA field & brand weight</span>
                      </span>
                      <span className="brand-studio-color-controls">
                        <input
                          type="color"
                          value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '#666666'}
                          onChange={(event) => setPrimaryColor(event.target.value)}
                          onBlur={() => patchBrand({ primaryColor })}
                          aria-label="Primary color picker"
                        />
                        <input
                          value={primaryColor}
                          onChange={(event) => setPrimaryColor(event.target.value)}
                          onBlur={() => patchBrand({ primaryColor })}
                          aria-label="Primary color value"
                          spellCheck={false}
                        />
                      </span>
                    </label>

                    <label className="brand-studio-color-card">
                      <span
                        className="brand-studio-color-swatch"
                        style={{ background: accentColor }}
                      />
                      <span className="brand-studio-color-meta">
                        <strong>Accent</strong>
                        <span>CTA edge highlight</span>
                      </span>
                      <span className="brand-studio-color-controls">
                        <input
                          type="color"
                          value={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : '#888888'}
                          onChange={(event) => setAccentColor(event.target.value)}
                          onBlur={() => patchBrand({ accentColor })}
                          aria-label="Accent color picker"
                        />
                        <input
                          value={accentColor}
                          onChange={(event) => setAccentColor(event.target.value)}
                          onBlur={() => patchBrand({ accentColor })}
                          aria-label="Accent color value"
                          spellCheck={false}
                        />
                      </span>
                    </label>

                    <div className="brand-studio-color-card is-caption">
                      <span
                        className="brand-studio-color-swatch"
                        style={{ background: captionBg }}
                        aria-hidden
                      />
                      <span className="brand-studio-color-meta">
                        <strong>Caption background</strong>
                        <span>Opacity {Math.round(captionAlpha(captionBg) * 100)}%</span>
                      </span>
                      <div className="brand-studio-color-controls">
                        <input
                          type="color"
                          value={captionPickerHex(captionBg)}
                          onChange={(event) => {
                            const rgb = hexToRgb(event.target.value)
                            if (!rgb) return
                            setCaptionBg(toRgba(rgb.r, rgb.g, rgb.b, captionAlpha(captionBg)))
                          }}
                          onBlur={() => patchBrand({ captionBg })}
                          aria-label="Caption background color"
                        />
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={captionAlpha(captionBg)}
                          aria-label="Caption background opacity"
                          onChange={(event) => {
                            const parsed = parseCssColor(captionBg) ?? {
                              r: 15,
                              g: 20,
                              b: 16,
                              a: 0.78,
                            }
                            setCaptionBg(
                              toRgba(parsed.r, parsed.g, parsed.b, Number(event.target.value)),
                            )
                          }}
                          onMouseUp={() => patchBrand({ captionBg })}
                          onTouchEnd={() => patchBrand({ captionBg })}
                        />
                        <input
                          value={captionBg}
                          onChange={(event) => setCaptionBg(event.target.value)}
                          onBlur={() => patchBrand({ captionBg })}
                          aria-label="Caption background CSS value"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {plane === 'type' ? (
                <section className="brand-studio-section">
                  <p className="brand-studio-section-lede">
                    Pick the family used for CTA and caption chrome. Preview updates instantly.
                  </p>
                  <div className="brand-studio-font-grid" role="listbox" aria-label="Font family">
                    {FONT_OPTIONS.map((font) => {
                      const active = fontFamily === font.value
                      return (
                        <button
                          key={font.value}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`brand-studio-font-card${active ? ' is-active' : ''}`}
                          onClick={() => {
                            setFontFamily(font.value)
                            patchBrand({ fontFamily: font.value })
                          }}
                        >
                          <span
                            className="brand-studio-font-sample"
                            style={{ fontFamily: font.value }}
                          >
                            Ag
                          </span>
                          <span className="brand-studio-font-copy">
                            <strong>{font.label}</strong>
                            <span>{font.meta}</span>
                          </span>
                          <span
                            className="brand-studio-font-sentence"
                            style={{ fontFamily: font.value }}
                          >
                            Try free — your CTA
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              {plane === 'messaging' ? (
                <section className="brand-studio-section">
                  <label className="brand-studio-field brand-studio-card">
                    <span className="brand-studio-field-label">Default CTA</span>
                    <span className="brand-studio-field-hint">
                      Burns into Path C exports. Keep it short and action-led.
                    </span>
                    <input
                      value={defaultCta}
                      onChange={(event) => setDefaultCta(event.target.value)}
                      onBlur={() => {
                        if (defaultCta.trim()) patchBrand({ defaultCta: defaultCta.trim() })
                      }}
                      placeholder="Try free — example.com"
                    />
                  </label>
                  <label className="brand-studio-field brand-studio-card">
                    <span className="brand-studio-field-label">Mood</span>
                    <span className="brand-studio-field-hint">
                      Prompt signal for Path A — not burned into the export frame.
                    </span>
                    <input
                      value={mood}
                      onChange={(event) => setMood(event.target.value)}
                      onBlur={() => {
                        if (mood.trim()) patchBrand({ mood: mood.trim() })
                      }}
                      placeholder="Calm, precise, founder-led"
                    />
                  </label>
                </section>
              ) : null}

              {plane === 'stills' ? (
                <section className="brand-studio-section">
                  <div className="brand-studio-card brand-studio-stills-toolbar">
                    <div className="brand-studio-card-head">
                      <h4>Reference stills</h4>
                      <p>
                        Used for Path B generation refs. The same images appear in the Media bin for
                        timeline drops.
                      </p>
                    </div>
                    <label className="btn btn-secondary">
                      Add still
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => uploadStill(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  {stillIds.length === 0 ? (
                    <div className="brand-studio-empty-panel">
                      <strong>No stills yet</strong>
                      <p>
                        Upload above, or import the Product brand library if this Product already
                        has one.
                      </p>
                    </div>
                  ) : (
                    <ul className="brand-studio-still-list">
                      {stillIds.map((id) => {
                        const asset = project.assets.find((item) => item.id === id)
                        const url = asset ? assetContentUrl(project.id, id) : undefined
                        const isPrimary = brand?.stillAssetId === id || stillIds[0] === id
                        return (
                          <li
                            key={id}
                            className={`brand-studio-still-item${isPrimary ? ' is-primary' : ''}`}
                          >
                            <div className="brand-studio-still-thumb">
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt="" />
                              ) : (
                                <span className="brand-studio-still-missing">
                                  Preview unavailable
                                </span>
                              )}
                              {isPrimary ? (
                                <span className="brand-studio-still-badge">Primary</span>
                              ) : null}
                            </div>
                            <div className="brand-studio-still-actions">
                              {!isPrimary ? (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => patchBrand({ primaryStillAssetId: id })}
                                >
                                  Make primary
                                </button>
                              ) : (
                                <span className="brand-studio-still-primary-label">Used first</span>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeStill(id)}
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              ) : null}

              {plane === 'chrome' ? (
                <section className="brand-studio-section">
                  <div className="brand-studio-card">
                    <div className="brand-studio-card-head">
                      <h4>Corner</h4>
                      <p>Where the logo bug sits on video exports.</p>
                    </div>
                    <div
                      className="brand-studio-corner-grid"
                      role="radiogroup"
                      aria-label="Logo corner"
                    >
                      {CORNER_OPTIONS.map((option) => {
                        const active = chrome.corner === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`brand-studio-corner-option${active ? ' is-active' : ''}`}
                            onClick={() => {
                              const next = { ...chrome, corner: option.value }
                              setChrome(next)
                              patchBrand({ chrome: next })
                            }}
                          >
                            <span className="brand-studio-corner-pad" aria-hidden>
                              <span className={`brand-studio-corner-dot is-${option.value}`} />
                            </span>
                            <span>{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <label className="brand-studio-field brand-studio-card">
                    <span className="brand-studio-field-label">
                      Scale <em className="tabular-nums">{chrome.scale.toFixed(2)}×</em>
                    </span>
                    <span className="brand-studio-field-hint">Relative size of the logo bug.</span>
                    <input
                      type="range"
                      min={0.4}
                      max={2.5}
                      step={0.05}
                      value={chrome.scale}
                      onChange={(event) =>
                        setChrome((prev) => ({ ...prev, scale: Number(event.target.value) }))
                      }
                      onMouseUp={() => patchBrand({ chrome })}
                      onTouchEnd={() => patchBrand({ chrome })}
                    />
                  </label>

                  <label className="brand-studio-field brand-studio-card">
                    <span className="brand-studio-field-label">
                      Safe margin <em className="tabular-nums">{chrome.safeMargin}px</em>
                    </span>
                    <span className="brand-studio-field-hint">
                      Inset from the frame edge so the mark clears platform UI.
                    </span>
                    <input
                      type="range"
                      min={8}
                      max={160}
                      step={2}
                      value={chrome.safeMargin}
                      onChange={(event) =>
                        setChrome((prev) => ({
                          ...prev,
                          safeMargin: Number(event.target.value),
                        }))
                      }
                      onMouseUp={() => patchBrand({ chrome })}
                      onTouchEnd={() => patchBrand({ chrome })}
                    />
                  </label>
                </section>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="brand-studio-footer">
          <div className="brand-studio-footer-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => setConfirmImport(true)}
            >
              Import product brand…
            </button>
            {brand ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={pending}
                onClick={() => setConfirmClear(true)}
              >
                Clear brand
              </button>
            ) : null}
          </div>
          <div className="brand-studio-footer-meta">
            {pending ? (
              <span className="brand-studio-saving" role="status" aria-live="polite">
                Saving…
              </span>
            ) : null}
            {status && !error ? <span className="brand-studio-footer-status">{status}</span> : null}
            {error ? (
              <p className="form-error brand-studio-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={confirmImport}
        title="Import product brand library?"
        body="This replaces the current project brand with the Product Brand Library (logos, stills, colors, CTA) for this Product. Only continue if you want that library — otherwise upload your own assets in Brand Studio."
        confirmLabel="Import and replace"
        onConfirm={() => {
          setConfirmImport(false)
          importProduct()
        }}
        onCancel={() => setConfirmImport(false)}
      />
      <ConfirmDialog
        open={confirmClear}
        title="Clear project brand?"
        body="Logo, stills, colors, font, and CTA will be removed from this project — including any imported Product library assets. Exports will render without brand chrome until you set a brand again."
        confirmLabel="Clear brand"
        onConfirm={clearBrand}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
