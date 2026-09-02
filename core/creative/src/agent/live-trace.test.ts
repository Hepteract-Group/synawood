import { describe, expect, it } from 'vitest'
import { toolNamesFromModelContent } from './live-trace'

describe('toolNamesFromModelContent (#1274)', () => {
  it('pulls tool-call names from a model step, ignoring text', () => {
    expect(
      toolNamesFromModelContent([
        { type: 'text', text: 'looking' },
        { type: 'tool-call', toolName: 'inspect_preview' },
        { type: 'tool-call', toolName: 'write_composition' },
      ]),
    ).toEqual(['inspect_preview', 'write_composition'])
  })

  it('skips empty and non-call parts', () => {
    expect(toolNamesFromModelContent([{ type: 'tool-call', toolName: '  ' }, null, 1])).toEqual([])
  })
})
