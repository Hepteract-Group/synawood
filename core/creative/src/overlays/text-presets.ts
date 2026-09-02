import type { OverlayKind } from '../project/schema'

export const TEXT_PRESET_MIME = 'application/x-mos-text-preset'

export type TextPresetId = 'hook' | 'lower_third' | 'title' | 'cta'

export type TextPreset = {
  id: TextPresetId
  label: string
  kind: Extract<OverlayKind, 'hook_title' | 'lower_third' | 'title' | 'end_card'>
  text: string
  /** Hook starts at 0; CTA uses end-card placement; others use the playhead. */
  place: 'start' | 'playhead' | 'end'
  durationInFrames: number
}

export const TEXT_PRESETS: readonly TextPreset[] = [
  {
    id: 'hook',
    label: 'Hook',
    kind: 'hook_title',
    text: 'Your hook',
    place: 'start',
    durationInFrames: 90,
  },
  {
    id: 'lower_third',
    label: 'Lower third',
    kind: 'lower_third',
    text: 'Name · Role',
    place: 'playhead',
    durationInFrames: 90,
  },
  {
    id: 'title',
    label: 'Title',
    kind: 'title',
    text: 'Title',
    place: 'playhead',
    durationInFrames: 90,
  },
  {
    id: 'cta',
    label: 'CTA',
    kind: 'end_card',
    text: 'Get started',
    place: 'end',
    durationInFrames: 90,
  },
]

export const getTextPreset = (id: string): TextPreset | undefined =>
  TEXT_PRESETS.find((preset) => preset.id === id)

export const encodeTextPresetDrag = (preset: TextPreset): string =>
  JSON.stringify({ id: preset.id, kind: preset.kind, text: preset.text })

export const parseTextPresetDrag = (raw: string): TextPreset | undefined => {
  try {
    const parsed = JSON.parse(raw) as { id?: string }
    return typeof parsed.id === 'string' ? getTextPreset(parsed.id) : undefined
  } catch {
    return undefined
  }
}
