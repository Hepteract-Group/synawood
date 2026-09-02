import { describe, expect, it, vi } from 'vitest'
import { generateThreadTitle } from './name-thread'

describe('generateThreadTitle (#853)', () => {
  it('falls back to a clamped user line when no model is available', async () => {
    const title = await generateThreadTitle({
      userText: 'please make a 30s interview prep ad for Povotra with music and a logo sting',
      assistantText: 'Done.',
      model: null,
    })
    expect(title).toBe('please make a 30s interview prep')
  })

  it('skips a string model id when the AI Gateway is not configured', async () => {
    const generateText = vi.fn(async () => ({ text: 'Should not run' }))
    const previous = process.env.AI_GATEWAY_API_KEY
    delete process.env.AI_GATEWAY_API_KEY
    const title = await generateThreadTitle({
      userText: 'add captions please',
      assistantText: 'Done.',
      model: 'openai/gpt-4.1-mini',
      generateText: generateText as never,
    })
    if (previous === undefined) delete process.env.AI_GATEWAY_API_KEY
    else process.env.AI_GATEWAY_API_KEY = previous
    expect(generateText).not.toHaveBeenCalled()
    expect(title).toBe('add captions please')
  })

  it('clamps a model name to six words', async () => {
    const generateText = vi.fn(async () => ({
      text: 'Povotra interview prep ads with music and extra words',
    }))
    const previous = process.env.AI_GATEWAY_API_KEY
    process.env.AI_GATEWAY_API_KEY = 'test'
    const title = await generateThreadTitle({
      userText: 'long founder prompt about Povotra interview ads',
      assistantText: 'I cut a 30s ad.',
      model: 'openai/gpt-4.1-mini',
      generateText: generateText as never,
    })
    if (previous === undefined) delete process.env.AI_GATEWAY_API_KEY
    else process.env.AI_GATEWAY_API_KEY = previous
    expect(title).toBe('Povotra interview prep ads with music')
    expect(generateText).toHaveBeenCalledOnce()
  })

  it('uses the fallback when generateText throws', async () => {
    const previous = process.env.AI_GATEWAY_API_KEY
    process.env.AI_GATEWAY_API_KEY = 'test'
    const title = await generateThreadTitle({
      userText: 'add captions',
      assistantText: 'Added.',
      model: 'openai/gpt-4.1-mini',
      generateText: (async () => {
        throw new Error('nope')
      }) as never,
    })
    if (previous === undefined) delete process.env.AI_GATEWAY_API_KEY
    else process.env.AI_GATEWAY_API_KEY = previous
    expect(title).toBe('add captions')
  })
})
