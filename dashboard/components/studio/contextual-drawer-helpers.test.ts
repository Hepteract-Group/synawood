import { describe, expect, it } from 'vitest'
import {
  defaultSelectedSuggestionIds,
  selectedSuggestionsCost,
  sortSuggestions,
  suggestionCostLabel,
  suggestionLayer,
} from './contextual-drawer-helpers'
import type { Suggestion } from '@synawood/creative/intent'

const sug = (
  partial: Partial<Suggestion> & Pick<Suggestion, 'id' | 'label' | 'tool'>,
): Suggestion => ({
  kind: 'trim',
  args: {},
  estimatedCostGbp: 0,
  requiresGenerator: false,
  ...partial,
})

describe('contextual-drawer-helpers', () => {
  it('defaults free rows selected and paid unchecked', () => {
    const rows = [
      sug({ id: 'sg_a', label: 'Shorten', tool: 'trim_clip' }),
      sug({
        id: 'gen_b',
        label: 'Overlay',
        tool: 'generate_video_clip',
        requiresGenerator: true,
        estimatedCostGbp: 0.2,
        kind: 'broll',
      }),
    ]
    expect([...defaultSelectedSuggestionIds(rows)]).toEqual(['sg_a'])
  })

  it('does not auto-select supporting B-roll so Apply selected stays a plan preview', () => {
    const rows = [
      sug({ id: 'sg_a', label: 'Shorten', tool: 'trim_clip' }),
      sug({
        id: 'sg_broll',
        label: 'Add supporting clips',
        tool: 'assemble_broll',
        kind: 'broll',
      }),
    ]
    expect([...defaultSelectedSuggestionIds(rows)]).toEqual(['sg_a'])
  })

  it('sorts heuristic before generator and labels cost', () => {
    const rows = sortSuggestions([
      sug({
        id: 'g1',
        label: 'Gen',
        tool: 'generate_image',
        requiresGenerator: true,
        estimatedCostGbp: 0.1,
        kind: 'broll',
      }),
      sug({ id: 'sg_x', label: 'Trim', tool: 'trim_clip' }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['sg_x', 'g1'])
    expect(suggestionLayer(rows[0]!)).toBe('heuristic')
    expect(suggestionCostLabel(rows[1]!)).toBe('est £0.10')
    expect(selectedSuggestionsCost(rows, new Set(['g1']))).toBe(0.1)
  })
})
