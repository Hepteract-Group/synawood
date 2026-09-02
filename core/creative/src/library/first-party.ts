/** First-party overlay packs as library items. No DB row (ADR-0059). Client-safe. */

import { listStylePacks } from '../effects/packs'
import { listTreatments } from '../effects/treatments'
import { CAPTION_STYLE_PRESETS } from '../overlays/caption-styles'
import { listFirstPartyStickers } from '../overlays/stickers'
import { TEXT_PRESETS } from '../overlays/text-presets'
import { firstPartyLibraryItem, type LibraryItem, type LibraryKind } from './schema'

export const listFirstPartyLibraryItems = (kind?: LibraryKind): LibraryItem[] => {
  const items: LibraryItem[] = []

  if (!kind || kind === 'sticker') {
    for (const sticker of listFirstPartyStickers()) {
      items.push(
        firstPartyLibraryItem({
          id: sticker.id,
          kind: 'sticker',
          label: sticker.label,
          recipe: { stickerId: sticker.id },
        }),
      )
    }
  }

  if (!kind || kind === 'filter') {
    for (const pack of listStylePacks()) {
      items.push(
        firstPartyLibraryItem({
          id: pack.id,
          kind: 'filter',
          label: pack.label,
          recipe: {
            contrast: pack.contrast,
            saturate: pack.saturate,
            hueRotate: pack.hueRotate,
            sepia: pack.sepia,
            vignette: pack.vignette,
          },
        }),
      )
    }
  }

  if (!kind || kind === 'effect') {
    for (const treatment of listTreatments()) {
      items.push(
        firstPartyLibraryItem({
          id: treatment.id,
          kind: 'effect',
          label: treatment.label,
          recipe: { steps: [{ id: treatment.id, intensity: 1 }] },
        }),
      )
    }
  }

  if (!kind || kind === 'text_preset') {
    for (const preset of TEXT_PRESETS) {
      items.push(
        firstPartyLibraryItem({
          id: preset.id,
          kind: 'text_preset',
          label: preset.label,
          recipe: {
            presetId: preset.id,
            overlayKind: preset.kind,
            text: preset.text,
            place: preset.place,
            durationInFrames: preset.durationInFrames,
          },
        }),
      )
    }
  }

  if (!kind || kind === 'caption_preset') {
    for (const preset of CAPTION_STYLE_PRESETS) {
      items.push(
        firstPartyLibraryItem({
          id: preset.id,
          kind: 'caption_preset',
          label: preset.label,
          recipe: { styleId: preset.id },
        }),
      )
    }
  }

  return items
}
