'use client'

import { listSfxPack, type SfxPackId } from '@synawood/creative/audio'
import { OverlayTile } from './OverlayTile'

type SoundsPackProps = {
  disabled?: boolean
  busy?: boolean
  onPlace: (packId: SfxPackId) => void
}

export const SoundsPack = ({ disabled = false, busy = false, onPlace }: SoundsPackProps) => (
  <div className="sounds-pack">
    <p className="muted asset-bin-empty-hint">
      Whoosh on the hook, hit on the ask. They land on the Sounds lane, not the music bed.
    </p>
    {busy ? (
      <div className="asset-bin-job-banner" role="status" aria-live="polite">
        Placing sound…
      </div>
    ) : null}
    <ul className="overlay-catalog-grid">
      {listSfxPack().map((item) => (
        <li key={item.id}>
          <OverlayTile
            label={item.label}
            disabled={disabled || busy}
            title={item.hint}
            onClick={() => onPlace(item.id)}
          >
            <span className={`sfx-wave is-${item.id}`} aria-hidden>
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </OverlayTile>
        </li>
      ))}
    </ul>
  </div>
)
