import { describe, expect, it } from 'vitest'
import {
  encodeTextPresetDrag,
  getTextPreset,
  parseTextPresetDrag,
  TEXT_PRESETS,
} from './text-presets'

describe('text presets', () => {
  it('ships Hook, Lower third, Title, and CTA', () => {
    expect(TEXT_PRESETS.map((preset) => preset.id)).toEqual(['hook', 'lower_third', 'title', 'cta'])
    expect(getTextPreset('hook')?.kind).toBe('hook_title')
    expect(getTextPreset('cta')?.kind).toBe('end_card')
    expect(getTextPreset('title')?.place).toBe('playhead')
  })

  it('round-trips drag payload by preset id', () => {
    const hook = getTextPreset('hook')
    expect(hook).toBeTruthy()
    const parsed = parseTextPresetDrag(encodeTextPresetDrag(hook!))
    expect(parsed?.id).toBe('hook')
    expect(parseTextPresetDrag('not-json')).toBeUndefined()
  })
})
