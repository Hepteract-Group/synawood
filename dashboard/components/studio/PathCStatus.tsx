'use client'

import type { StudioProject } from '@synawood/creative/project/client'
import { useEffect, useState } from 'react'
import { assetContentUrl, type GalleryAsset } from './AssetLibrary'
import { ConfirmDialog } from './ConfirmDialog'

type PathCStatusProps = {
  project: StudioProject & { assets: GalleryAsset[] }
  onOpenStudio: () => void
  onClearBrand: () => void
  clearing?: boolean
}

export const PathCStatus = ({
  project,
  onOpenStudio,
  onClearBrand,
  clearing,
}: PathCStatusProps) => {
  const brand = project.brand
  const logoAsset = brand?.logoAssetId
    ? (project.assets as GalleryAsset[]).find((asset) => asset.id === brand.logoAssetId)
    : undefined
  const logoUrl = logoAsset ? assetContentUrl(project.id, logoAsset.id) : undefined
  const [logoFailed, setLogoFailed] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    setLogoFailed(false)
  }, [logoUrl])

  if (!brand) {
    return (
      <div className="brand-status">
        <div className="brand-status-text">
          <strong>No brand on this project</strong>
          <p className="muted">
            Upload your logo and stills in Brand Studio. Nothing is imported automatically.
          </p>
        </div>
        <div className="brand-status-actions">
          <button type="button" className="btn btn-primary" onClick={onOpenStudio}>
            Open Brand Studio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="brand-status">
      <div className="brand-status-mark">
        {logoUrl && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Brand logo" onError={() => setLogoFailed(true)} />
        ) : (
          <span className="brand-status-mark-missing">
            {logoFailed ? 'Preview unavailable' : 'no logo'}
          </span>
        )}
      </div>
      <div className="brand-status-detail">
        <div className="brand-status-swatches">
          <span style={{ background: brand.primaryColor ?? '#666' }} title="primary" />
          <span style={{ background: brand.accentColor ?? '#666' }} title="accent" />
        </div>
        <p className="muted">
          {brand.fontFamily ?? 'no font'} · {brand.defaultCta ?? 'no CTA'}
        </p>
      </div>
      <div className="brand-status-actions">
        <button type="button" className="btn btn-primary" onClick={onOpenStudio}>
          Edit in Brand Studio
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={clearing}
          onClick={() => setConfirmClear(true)}
        >
          {clearing ? 'Clearing…' : 'Clear brand'}
        </button>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear project brand?"
        body="Removes logo, stills, colors, and CTA from this project. Path C chrome will disappear until you set a brand again."
        confirmLabel="Clear brand"
        onConfirm={() => {
          setConfirmClear(false)
          onClearBrand()
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
