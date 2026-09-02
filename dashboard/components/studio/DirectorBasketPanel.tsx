'use client'

import type { DirectorBasketItem } from './director-basket'

type DirectorBasketPanelProps = {
  items: DirectorBasketItem[]
  onRemove: (input: { assetId: string; shotId?: string }) => void
  onClear: () => void
  onUseInDirector: () => void
}

export const DirectorBasketPanel = ({
  items,
  onRemove,
  onClear,
  onUseInDirector,
}: DirectorBasketPanelProps) => {
  if (items.length === 0) return null

  return (
    <div className="director-basket" aria-label="Director basket">
      <header className="director-basket-header">
        <strong>Director basket</strong>
        <span className="muted">{items.length}</span>
      </header>
      <ol className="director-basket-list">
        {items.map((item) => (
          <li key={`${item.assetId}:${item.shotId ?? ''}`} className="director-basket-item">
            <div>
              <code className="director-basket-id">{item.assetId.slice(0, 8)}</code>
              {item.shotId ? <span className="muted"> · {item.shotId}</span> : null}
              {item.caption ? <p className="director-basket-caption">{item.caption}</p> : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onRemove({ assetId: item.assetId, shotId: item.shotId })}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="director-basket-actions">
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="btn btn-primary" onClick={onUseInDirector}>
          Use in Director
        </button>
      </div>
    </div>
  )
}
