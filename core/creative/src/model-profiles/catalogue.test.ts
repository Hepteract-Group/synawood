import { describe, expect, it } from 'vitest'
import {
  buildModelCatalogue,
  FROZEN_MODEL_SENTENCE,
  isFrozenModelId,
  isFrozenReasonerModelId,
  isFrozenVideoModelId,
  modelCatalogueStatus,
  roleOptionDisabled,
  withFrozenPickerOption,
} from './catalogue'
import { isFrozenImageModelId } from './image-models'

describe('buildModelCatalogue', () => {
  it('groups Reason, Pictures, and Video without dumping every Gateway id', () => {
    const catalogue = buildModelCatalogue()
    expect(catalogue.sections.map((section) => section.title)).toEqual([
      'Reason',
      'Pictures',
      'Video',
    ])
    const total = catalogue.sections.reduce((count, section) => count + section.entries.length, 0)
    expect(total).toBeGreaterThan(6)
    expect(total).toBeLessThan(40)
  })

  it('includes use-when, meta, and Live badge data on each row', () => {
    const catalogue = buildModelCatalogue()
    const veo = catalogue.sections
      .find((section) => section.title === 'Video')
      ?.entries.find((entry) => entry.id === 'google/veo-3.1-fast-generate-001')
    expect(veo).toMatchObject({
      label: 'Veo 3.1 Fast',
      status: 'live',
      useWhen: expect.stringMatching(/4–8s/),
      meta: expect.stringMatching(/£/),
    })
  })

  it('uses the full frozen sentence copy', () => {
    expect(FROZEN_MODEL_SENTENCE).toMatch(/gone from Vercel/)
    expect(modelCatalogueStatus('xai/not-a-real-model', 'pictures')).toBe('frozen')
  })
})

describe('isFrozenModelId', () => {
  it('freezes leftover xai/ image ids without a remap', () => {
    expect(isFrozenImageModelId('xai/not-a-real-model')).toBe(true)
    expect(isFrozenModelId('xai/not-a-real-model', 'pictures')).toBe(true)
    expect(isFrozenModelId('spacexai/grok-imagine-image', 'pictures')).toBe(false)
  })

  it('freezes unknown reasoner ids', () => {
    expect(isFrozenReasonerModelId('openai/gpt-5-unknown')).toBe(true)
    expect(isFrozenModelId('openai/gpt-4.1-mini', 'reason')).toBe(false)
  })

  it('freezes unknown video ids in known families', () => {
    expect(isFrozenVideoModelId('google/veo-9.9-generate-001')).toBe(true)
    expect(isFrozenModelId('google/veo-3.1-fast-generate-001', 'video')).toBe(false)
  })
})

describe('roleOptionDisabled', () => {
  it('marks frozen ids disabled for pickers', () => {
    expect(roleOptionDisabled('xai/not-a-real-model', 'pictures')).toBe(true)
    expect(roleOptionDisabled('google/gemini-3.1-flash-image', 'pictures')).toBe(false)
  })
})

describe('withFrozenPickerOption', () => {
  it('appends a disabled row when the selected id is frozen', () => {
    const base = [{ id: 'live/id', label: 'Live' }]
    const next = withFrozenPickerOption(base, 'xai/not-a-real-model', 'pictures')
    expect(next).toHaveLength(2)
    expect(next[1]).toMatchObject({ id: 'xai/not-a-real-model', disabled: true })
  })
})
