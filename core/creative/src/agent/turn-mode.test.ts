import { describe, expect, it } from 'vitest'
import {
  omitToolsForTurnMode,
  parseTurnMode,
  resolveTurnMode,
  turnModeAllowsGenerate,
  turnModeNeedsCutReview,
  turnModePromptBlock,
} from './turn-mode'

const PLAN_FEEDBACK = `some things to update in the plan:

For VO: use a synthesized voice. I will not provide a voice for this turn.
Yes, I will turn on image and video gen.
Generate a new plan based on the above, before i approve and turn on image and video gen`

describe('turn mode (#1325 / #1328)', () => {
  it('parses known ids and defaults execute', () => {
    expect(parseTurnMode('plan')).toBe('plan')
    expect(parseTurnMode('nope')).toBe('execute')
    expect(parseTurnMode(undefined)).toBe('execute')
  })

  it('keeps the footer picker — wording cannot steal the mode', () => {
    expect(resolveTurnMode({ selected: 'execute', userMessage: PLAN_FEEDBACK })).toBe('execute')
    expect(
      resolveTurnMode({
        selected: 'execute',
        userMessage: 'Come up with a kinetic type ad plan to introduce Povotra.',
      }),
    ).toBe('execute')
    expect(resolveTurnMode({ selected: 'plan', userMessage: 'go make it' })).toBe('plan')
    expect(resolveTurnMode({ selected: 'plan', userMessage: 'rebuild the plan' })).toBe('plan')
    expect(
      resolveTurnMode({
        selected: 'execute',
        userMessage: 'Re-execute the plan for the composition so the Player is not black.',
      }),
    ).toBe('execute')
    expect(resolveTurnMode({ selected: 'execute', userMessage: 'what is on the timeline?' })).toBe(
      'execute',
    )
    expect(
      resolveTurnMode({
        selected: 'execute',
        userMessage: 'press play and tell me what to change',
      }),
    ).toBe('execute')
    expect(
      resolveTurnMode({ selected: 'plan', userMessage: 'press play and tell me what to change' }),
    ).toBe('plan')
  })

  it('Execute prompt tells the agent to distinguish plan-only vs make', () => {
    const execute = turnModePromptBlock('execute')
    expect(execute).toMatch(/footer picker is binding/)
    expect(execute).toMatch(/If they only want a plan/)
    expect(execute).toMatch(/If they want it made, rebuilt, written/)
    const plan = turnModePromptBlock('plan')
    expect(plan).toMatch(/switch the footer to Execute/)
  })

  it('Ask / Inspect / Plan still strip generate; Execute keeps it', () => {
    expect(turnModeAllowsGenerate('ask')).toBe(false)
    expect(turnModeNeedsCutReview('ask')).toBe(false)
    expect(turnModeNeedsCutReview('inspect')).toBe(false)
    expect(turnModeAllowsGenerate('execute')).toBe(true)
    expect(turnModeNeedsCutReview('execute')).toBe(true)
  })

  it('Inspect may plan from what it saw; Execute keeps generate', () => {
    const tools = {
      inspect_preview: {},
      plan_scenes: {},
      draft_generation_plan: {},
      generate_music: {},
      write_composition: {},
    }
    expect(Object.keys(omitToolsForTurnMode(tools, 'inspect')).sort()).toEqual([
      'draft_generation_plan',
      'inspect_preview',
      'plan_scenes',
    ])
    expect(Object.keys(omitToolsForTurnMode(tools, 'execute')).sort()).toEqual([
      'draft_generation_plan',
      'generate_music',
      'inspect_preview',
      'plan_scenes',
      'write_composition',
    ])
    expect(Object.keys(omitToolsForTurnMode(tools, 'plan')).sort()).toEqual([
      'draft_generation_plan',
      'plan_scenes',
    ])
  })

  it('strips generate tools in Plan and Ask', () => {
    const tools = {
      generate_music: {},
      generate_video_clip: {},
      draft_generation_plan: {},
      get_project_summary: {},
      inspect_preview: {},
    }
    expect(Object.keys(omitToolsForTurnMode(tools, 'plan')).sort()).toEqual([
      'draft_generation_plan',
      'get_project_summary',
    ])
    expect(Object.keys(omitToolsForTurnMode(tools, 'ask'))).toEqual(['get_project_summary'])
    expect(Object.keys(omitToolsForTurnMode(tools, 'inspect')).sort()).toEqual([
      'draft_generation_plan',
      'get_project_summary',
      'inspect_preview',
    ])
    expect(Object.keys(omitToolsForTurnMode(tools, 'execute'))).toHaveLength(5)
  })
})
