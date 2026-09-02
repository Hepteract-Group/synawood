import { describe, expect, it, vi } from 'vitest'
import { recordToolTrace, wrapTool } from './store'
import { toolOk, type StudioToolContext } from './types'

const ctx = (extra?: Partial<StudioToolContext>): StudioToolContext =>
  ({
    productId: 'demo',
    projectId: '11111111-1111-4111-8111-111111111111',
    project: {} as StudioToolContext['project'],
    expectedRevision: 1,
    supabase: {} as StudioToolContext['supabase'],
    blobEnv: {} as StudioToolContext['blobEnv'],
    modelProfileId: 'mock',
    persist: false,
    toolTrace: [],
    ...extra,
  }) as StudioToolContext

describe('tool trace live callbacks (#1270)', () => {
  it('notifies onToolStart then onTool when wrapTool finishes', async () => {
    const onToolStart = vi.fn()
    const onTool = vi.fn()
    const context = ctx({ onToolStart, onTool })
    const outcome = await wrapTool(context, 'generate_image', { prompt: 'x' }, async () =>
      toolOk('ok'),
    )
    expect(outcome.ok).toBe(true)
    expect(onToolStart).toHaveBeenCalledWith('generate_image')
    expect(onTool).toHaveBeenCalledTimes(1)
    expect(onTool.mock.calls[0]?.[0]).toMatchObject({
      toolName: 'generate_image',
      outcome: { ok: true, summary: 'ok' },
    })
  })

  it('awaits an async onToolStart before running the tool', async () => {
    const order: string[] = []
    const context = ctx({
      onToolStart: async () => {
        order.push('start')
        await Promise.resolve()
        order.push('flushed')
      },
    })
    await wrapTool(context, 'get_project_summary', {}, async () => {
      order.push('run')
      return toolOk('ok')
    })
    expect(order).toEqual(['start', 'flushed', 'run'])
  })

  it('recordToolTrace notifies onTool for MCP-style direct records', () => {
    const onTool = vi.fn()
    const context = ctx({ onTool })
    recordToolTrace(context, 'mcp_search', {}, toolOk('hit'))
    expect(onTool).toHaveBeenCalledTimes(1)
    expect(context.toolTrace).toHaveLength(1)
  })

  it('does not stamp confirmSpend onto tools that do not take it (#1328)', async () => {
    const input: Record<string, unknown> = { emotion: 'urgent' }
    await wrapTool(ctx({ confirmSpend: true }), 'set_intent', input, async () => toolOk('ok'))
    expect(input).not.toHaveProperty('confirmSpend')
  })

  it('strips surplus confirmSpend off the same object execute closed over (#1328)', async () => {
    const input: Record<string, unknown> = { emotion: 'urgent', confirmSpend: true }
    await wrapTool(ctx(), 'set_intent', input, async () => {
      expect(input).not.toHaveProperty('confirmSpend')
      return toolOk('ok')
    })
  })

  it('keeps confirmSpend on paid generate tools (#1328)', async () => {
    const input: Record<string, unknown> = { prompt: 'bed', confirmSpend: true }
    await wrapTool(ctx(), 'generate_music', input, async () => {
      expect(input.confirmSpend).toBe(true)
      return toolOk('ok')
    })
    const vo: Record<string, unknown> = { text: 'Hello grads.', confirmSpend: true }
    await wrapTool(ctx(), 'generate_voiceover', vo, async () => {
      expect(vo.confirmSpend).toBe(true)
      return toolOk('ok')
    })
  })
})
