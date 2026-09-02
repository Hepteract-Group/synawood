'use client'

import { LibraryAuthoring } from './LibraryAuthoring'
import { OverlayTile } from './OverlayTile'
import {
  encodeStickerDrag,
  FIRST_PARTY_STICKERS,
  STICKER_PRESET_MIME,
  stickerDataUrl,
} from '@synawood/creative/overlays'

type StickersBinProps = {
  projectId: string
  disabled?: boolean
  busy?: boolean
  confirmSpend?: boolean
  onPlace: (stickerId: string) => void
}

export const StickersBin = ({
  projectId,
  disabled = false,
  busy = false,
  confirmSpend = false,
  onPlace,
}: StickersBinProps) => (
  <div className="asset-bin-body">
    <LibraryAuthoring
      projectId={projectId}
      kind="sticker"
      disabled={disabled}
      confirmSpend={confirmSpend}
    />
    {busy ? (
      <div className="asset-bin-job-banner" role="status" aria-live="polite">
        Placing sticker…
      </div>
    ) : null}
    <p className="muted asset-bin-empty-hint">
      Click to place at the playhead, or drag onto the overlay lane. Stickers stay on the overlay
      track — they never become a full-frame MAIN clip.
    </p>
    <ul className="overlay-catalog-grid">
      {FIRST_PARTY_STICKERS.map((sticker) => (
        <li key={sticker.id}>
          <OverlayTile
            label={sticker.label}
            disabled={disabled || busy}
            draggable={!disabled && !busy}
            onClick={() => onPlace(sticker.id)}
            onDragStart={(event) => {
              if (disabled || busy) return
              event.dataTransfer.effectAllowed = 'copy'
              event.dataTransfer.setData(STICKER_PRESET_MIME, encodeStickerDrag(sticker.id))
              event.dataTransfer.setData('text/plain', sticker.label)
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stickerDataUrl(sticker)} alt="" />
          </OverlayTile>
        </li>
      ))}
    </ul>
  </div>
)
