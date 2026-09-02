import { STUDIO_TOOL_NAMES, type StudioToolName } from './studio-tools'

export const LOCKED_FIRST_PARTY_TOOL_NAMES = [
  'inspect_preview',
  'list_motion_kit',
  'write_composition',
  'patch_composition',
  'set_motion_seed',
  'get_project_summary',
  'add_clip',
  'place_clip',
  'trim_clip',
  'remove_clip',
] as const satisfies readonly StudioToolName[]

export const OPTIONAL_GENERATE_TOOL_NAMES = [
  'generate_image',
  'generate_voiceover',
  'generate_music',
  'generate_video_clip',
  'generate_slide_background',
  'generate_campaign_creatives',
] as const satisfies readonly StudioToolName[]

export const MAKE_VIDEO_DISABLED_MESSAGE =
  'Make a video will fail until you turn generate_video_clip back on in Settings → Agent tools. Cut review is not skipped.'

export type ToolCatalogSource = 'first-party' | 'mcp'
export type ToolCatalogKind = 'locked' | 'optional' | 'policy'

export type ToolCatalogRow = {
  id: string
  name: string
  source: ToolCatalogSource
  kind: ToolCatalogKind
  enabled: boolean
  toggleable: boolean
  warning: string | null
  /** MCP-only: tool missing from latest tools/list refresh (#1086). */
  stale?: boolean
}

const POLICY_ROWS: ToolCatalogRow[] = [
  {
    id: 'policy:confirm-spend',
    name: 'Spend confirm when estimated £ > 0',
    source: 'first-party',
    kind: 'policy',
    enabled: true,
    toggleable: false,
    warning: null,
  },
  {
    id: 'policy:approve-final',
    name: 'Approve → Final',
    source: 'first-party',
    kind: 'policy',
    enabled: true,
    toggleable: false,
    warning: null,
  },
]

const isOptionalGenerate = (name: string): name is (typeof OPTIONAL_GENERATE_TOOL_NAMES)[number] =>
  (OPTIONAL_GENERATE_TOOL_NAMES as readonly string[]).includes(name)

export const sanitizeDisabledOptionalTools = (names: readonly string[]): string[] => {
  const allowed = new Set<string>(OPTIONAL_GENERATE_TOOL_NAMES)
  const locked = new Set<string>(LOCKED_FIRST_PARTY_TOOL_NAMES)
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].filter(
    (name) => allowed.has(name) && !locked.has(name),
  )
}

export const videoGenerateIsDisabled = (disabledOptional: readonly string[]): boolean =>
  disabledOptional.includes('generate_video_clip')

export const buildFirstPartyToolCatalog = (input?: {
  disabledOptional?: readonly string[]
  mcpRows?: ToolCatalogRow[]
}): ToolCatalogRow[] => {
  const disabled = new Set(sanitizeDisabledOptionalTools(input?.disabledOptional ?? []))
  const locked = LOCKED_FIRST_PARTY_TOOL_NAMES.map((name): ToolCatalogRow => ({
    id: name,
    name,
    source: 'first-party',
    kind: 'locked',
    enabled: true,
    toggleable: false,
    warning: null,
  }))
  const optional = OPTIONAL_GENERATE_TOOL_NAMES.map((name): ToolCatalogRow => {
    const enabled = !disabled.has(name)
    return {
      id: name,
      name,
      source: 'first-party',
      kind: 'optional',
      enabled,
      toggleable: true,
      warning: name === 'generate_video_clip' && !enabled ? MAKE_VIDEO_DISABLED_MESSAGE : null,
    }
  })
  const rest = STUDIO_TOOL_NAMES.filter(
    (name) =>
      !(LOCKED_FIRST_PARTY_TOOL_NAMES as readonly string[]).includes(name) &&
      !isOptionalGenerate(name),
  ).map((name): ToolCatalogRow => ({
    id: name,
    name,
    source: 'first-party',
    kind: 'optional',
    enabled: true,
    toggleable: false,
    warning: null,
  }))
  const mcp = (input?.mcpRows ?? []).map((row) => ({ ...row, source: 'mcp' as const }))
  return [...POLICY_ROWS, ...locked, ...optional, ...rest, ...mcp]
}

export const omitDisabledOptionalTools = <T extends Record<string, unknown>>(
  tools: T,
  disabledOptional: readonly string[],
): T => {
  const drop = new Set(sanitizeDisabledOptionalTools(disabledOptional))
  const next = { ...tools }
  for (const name of drop) {
    delete next[name]
  }
  return next
}
