import { describe, expect, it } from 'vitest'
import {
  LOCKED_FIRST_PARTY_TOOL_NAMES,
  MAKE_VIDEO_DISABLED_MESSAGE,
  OPTIONAL_GENERATE_TOOL_NAMES,
  buildFirstPartyToolCatalog,
  omitDisabledOptionalTools,
  sanitizeDisabledOptionalTools,
  videoGenerateIsDisabled,
} from './first-party-catalog'

describe('first-party tool catalog (#962)', () => {
  it('keeps locked tools on and not toggleable', () => {
    const catalog = buildFirstPartyToolCatalog({
      disabledOptional: ['inspect_preview', 'generate_video_clip'],
    })
    for (const name of LOCKED_FIRST_PARTY_TOOL_NAMES) {
      const row = catalog.find((item) => item.id === name)
      expect(row).toMatchObject({ enabled: true, toggleable: false, kind: 'locked' })
    }
    expect(sanitizeDisabledOptionalTools(['inspect_preview', 'generate_video_clip'])).toEqual([
      'generate_video_clip',
    ])
  })

  it('warns when generate_video_clip is off and omits it from the tool map', () => {
    const disabled = ['generate_video_clip']
    const catalog = buildFirstPartyToolCatalog({ disabledOptional: disabled })
    const video = catalog.find((row) => row.id === 'generate_video_clip')
    expect(video?.enabled).toBe(false)
    expect(video?.warning).toBe(MAKE_VIDEO_DISABLED_MESSAGE)
    expect(videoGenerateIsDisabled(disabled)).toBe(true)
    expect(
      omitDisabledOptionalTools(
        { inspect_preview: {}, generate_video_clip: {}, generate_image: {} },
        disabled,
      ),
    ).toEqual({ inspect_preview: {}, generate_image: {} })
  })

  it('leaves an MCP slot on the same catalog', () => {
    const catalog = buildFirstPartyToolCatalog({
      mcpRows: [
        {
          id: 'mcp:srv:search',
          name: 'search',
          source: 'mcp',
          kind: 'optional',
          enabled: false,
          toggleable: true,
          warning: null,
        },
      ],
    })
    expect(catalog.some((row) => row.source === 'mcp')).toBe(true)
    expect(OPTIONAL_GENERATE_TOOL_NAMES.length).toBeGreaterThan(0)
  })
})
