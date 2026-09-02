import { describe, expect, it } from 'vitest'
import { tool } from 'ai'
import { z } from 'zod'
import { toolsAcceptingSurplusConfirmSpend } from './accept-surplus-confirm-spend'

describe('toolsAcceptingSurplusConfirmSpend (#1328)', () => {
  it('lets set_intent-shaped tools accept surplus confirmSpend and drops it before execute', async () => {
    const tools = toolsAcceptingSurplusConfirmSpend({
      set_intent: tool({
        description: 'intent',
        inputSchema: z.object({ emotion: z.string().optional() }),
        execute: async (input) => input,
      }),
    })
    const schema = tools.set_intent.inputSchema as z.ZodType
    expect(schema.safeParse({ emotion: 'urgent', confirmSpend: true })).toEqual({
      success: true,
      data: { emotion: 'urgent', confirmSpend: true },
    })
    const json = z.toJSONSchema(schema) as { properties?: Record<string, unknown> }
    expect(json.properties).toHaveProperty('confirmSpend')
    const result = await tools.set_intent.execute!({ emotion: 'urgent', confirmSpend: true }, {
      toolCallId: '1',
      messages: [],
    } as never)
    expect(result).toEqual({ emotion: 'urgent' })
    expect(result).not.toHaveProperty('confirmSpend')
  })

  it('keeps confirmSpend on paid generate tools that declare it', async () => {
    const tools = toolsAcceptingSurplusConfirmSpend({
      generate_music: tool({
        description: 'music',
        inputSchema: z.object({
          prompt: z.string(),
          confirmSpend: z.boolean().optional(),
        }),
        execute: async (input) => input,
      }),
    })
    const result = await tools.generate_music.execute!({ prompt: 'bed', confirmSpend: true }, {
      toolCallId: '1',
      messages: [],
    } as never)
    expect(result).toEqual({ prompt: 'bed', confirmSpend: true })
  })

  it('drops surplus confirmSpend on empty-object tools like inspect_preview', async () => {
    let saw: unknown
    const tools = toolsAcceptingSurplusConfirmSpend({
      inspect_preview: tool({
        description: 'inspect',
        inputSchema: z.object({}),
        execute: async (input) => {
          saw = input
          return { ok: true }
        },
      }),
    })
    await tools.inspect_preview.execute!({ confirmSpend: true }, {
      toolCallId: '1',
      messages: [],
    } as never)
    expect(saw).toEqual({})
  })
})
