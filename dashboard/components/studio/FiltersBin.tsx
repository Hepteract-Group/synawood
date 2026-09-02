'use client'

import { cssFilterForPack, listStylePacks, type StylePack } from '@synawood/creative/effects/packs'
import { LibraryAuthoring } from './LibraryAuthoring'
import { OverlayTile } from './OverlayTile'

type FiltersBinProps = {
  projectId: string
  disabled?: boolean
  busy?: boolean
  scope: 'cut' | 'clip'
  activePackId?: string | null
  onApply: (packId: string | null) => Promise<void>
}

const FilterStill = ({ pack }: { pack?: StylePack }) => (
  <span className="overlay-tile-split" aria-hidden>
    <span className="overlay-tile-half is-before" />
    <span
      className="overlay-tile-half is-after"
      style={
        pack
          ? {
              filter: cssFilterForPack(pack),
              boxShadow: `inset 0 0 ${Math.round(pack.vignette * 28)}px rgba(0,0,0,${0.35 + pack.vignette * 0.4})`,
            }
          : undefined
      }
    />
  </span>
)

export const FiltersBin = ({
  projectId,
  disabled = false,
  busy = false,
  scope,
  activePackId = null,
  onApply,
}: FiltersBinProps) => (
  <div className="asset-bin-body">
    <LibraryAuthoring projectId={projectId} kind="filter" disabled={disabled} />
    {busy ? (
      <div className="asset-bin-job-banner" role="status" aria-live="polite">
        Applying look…
      </div>
    ) : null}
    <p className="filters-scope-label" role="status">
      {scope === 'clip' ? 'Apply to selected clip' : 'Apply to cut'}
    </p>
    <p className="muted asset-bin-empty-hint">
      First-party looks grade the preview. Path C logo stays on top. Clear to remove the grade.
    </p>
    <ul className="overlay-catalog-grid">
      <li>
        <OverlayTile
          label="None"
          selected={!activePackId}
          disabled={disabled || busy}
          onClick={() => void onApply(null)}
        >
          <FilterStill />
        </OverlayTile>
      </li>
      {listStylePacks().map((pack: StylePack) => (
        <li key={pack.id}>
          <OverlayTile
            label={pack.label}
            selected={activePackId === pack.id}
            disabled={disabled || busy}
            onClick={() => void onApply(pack.id)}
          >
            <FilterStill pack={pack} />
          </OverlayTile>
        </li>
      ))}
    </ul>
  </div>
)
