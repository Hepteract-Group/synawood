/** Chat-footer turn mode (Cursor-style).
 * Browser-safe: no Node imports. Dashboard must import this deep path, never `@synawood/creative/agent`.
 *
 * The footer picker is the router. Do not regex- or classifier-guess mode from the
 * message — that cannot scale (“rebuild the plan” vs “give me a plan”). The Studio
 * Agent already reads the user text under the selected mode.
 */

export const TURN_MODES = ['plan', 'ask', 'inspect', 'execute'] as const
export type TurnMode = (typeof TURN_MODES)[number]

export const DEFAULT_TURN_MODE: TurnMode = 'execute'

export const TURN_MODE_OPTIONS: readonly { id: TurnMode; label: string; description: string }[] = [
  {
    id: 'plan',
    label: 'Plan',
    description: 'Detailed plan only. Cannot write the Player or generate.',
  },
  { id: 'ask', label: 'Ask', description: 'Questions about the project. Read-only tools.' },
  {
    id: 'inspect',
    label: 'Inspect',
    description: 'Watch the player, then recommend changes or a plan.',
  },
  {
    id: 'execute',
    label: 'Execute',
    description: 'Plan, inspect, and make the ad. Generate and edit are on.',
  },
]

export const parseTurnMode = (value: unknown): TurnMode =>
  typeof value === 'string' && (TURN_MODES as readonly string[]).includes(value)
    ? (value as TurnMode)
    : DEFAULT_TURN_MODE

/** Picker is binding. `userMessage` is ignored (kept so call sites stay stable). */
export const resolveTurnMode = (input: { selected: TurnMode; userMessage?: string }): TurnMode =>
  parseTurnMode(input.selected)

const TURN_MODE_CAPS: Record<TurnMode, { generate: boolean; cutReview: boolean }> = {
  plan: { generate: false, cutReview: false },
  ask: { generate: false, cutReview: false },
  inspect: { generate: false, cutReview: false },
  execute: { generate: true, cutReview: true },
}

export const turnModeAllowsGenerate = (mode: TurnMode): boolean => TURN_MODE_CAPS[mode].generate

export const turnModeNeedsCutReview = (mode: TurnMode): boolean => TURN_MODE_CAPS[mode].cutReview

const ASK_TOOLS = new Set([
  'get_project_summary',
  'find_assets',
  'find_moments',
  'list_assets_by_tag',
  'describe_asset',
  'analyze_asset',
  'list_motion_kit',
  'list_library',
  'list_branches',
])

const PLAN_TOOLS = new Set([
  ...ASK_TOOLS,
  'set_intent',
  'plan_scenes',
  'draft_generation_plan',
  'update_generation_plan',
  'import_product_brand',
])

const INSPECT_TOOLS = new Set([...PLAN_TOOLS, 'inspect_preview'])

export const toolsAllowedForTurnMode = (mode: TurnMode): ReadonlySet<string> | null => {
  if (mode === 'execute') return null
  if (mode === 'plan') return PLAN_TOOLS
  if (mode === 'inspect') return INSPECT_TOOLS
  return ASK_TOOLS
}

export const omitToolsForTurnMode = <T extends Record<string, unknown>>(
  tools: T,
  mode: TurnMode,
): T => {
  const allowed = toolsAllowedForTurnMode(mode)
  if (!allowed) return tools
  const next = { ...tools }
  for (const name of Object.keys(next)) {
    if (!allowed.has(name)) delete next[name]
  }
  return next
}

export const turnModePromptBlock = (mode: TurnMode): string => {
  if (mode === 'plan') {
    return [
      'TURN MODE: Plan. The footer picker is binding — do not infer a different mode from wording.',
      'Your chat reply IS the deliverable: a detailed creative plan the operator can sign off.',
      'Cover concept/angle, scene-by-scene timings, craft (footage vs motion graphics), music/VO, images, constraints, and the next Execute step.',
      'You may call set_intent, plan_scenes, draft_generation_plan, list_motion_kit, get_project_summary, import_product_brand.',
      'Do not generate image/video/music. Do not write_composition or edit the timeline. Do not call inspect_preview. Do not say the ad is done. Do not reply with a one-liner.',
      'If they asked you to make, rebuild, or write the ad, tell them to switch the footer to Execute. Do not pretend you made it.',
    ].join(' ')
  }
  if (mode === 'ask') {
    return [
      'TURN MODE: Ask. The footer picker is binding.',
      'Answer questions using read-only tools (get_project_summary, find_*, describe_asset, list_*).',
      'Do not mutate the project. Do not generate. Do not inspect_preview unless they switch to Inspect.',
    ].join(' ')
  }
  if (mode === 'inspect') {
    return [
      'TURN MODE: Inspect. The footer picker is binding.',
      'Watch the player: call inspect_preview, then write change recommendations and/or a revised plan based on what you saw.',
      'You may call plan_scenes and draft_generation_plan after you have looked. Do not generate new clips or rewrite the composition — that is Execute. If they asked you to make it, tell them to switch the footer to Execute.',
    ].join(' ')
  }
  return [
    'TURN MODE: Execute. The footer picker is binding — you distinguish intent from the message.',
    'You may plan, inspect, and make the ad in this turn. Call tools.',
    'If they only want a plan (sign-off, no make yet), call set_intent / plan_scenes / draft_generation_plan and stop. Do not write_composition or generate.',
    'If they want it made, rebuilt, written, or the Player fixed, write_composition / patch_composition or generate as the craft requires. After picture/composition changes, inspect_preview before you claim done.',
  ].join(' ')
}
