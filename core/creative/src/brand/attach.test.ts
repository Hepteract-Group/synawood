import { describe, expect, it } from 'vitest'
import { buildBrandPromptContext, loadBrandKitFiles } from './attach'
import { toBrandPromptBlock } from './prompt-context'

describe('brand kit', () => {
  it('loads the demo kit and builds Path A prompt context', async () => {
    const kit = await loadBrandKitFiles('demo')
    const ctx = buildBrandPromptContext({
      productId: 'demo',
      manifest: kit.manifest,
      colors: kit.colors,
      style: kit.style,
      voice: kit.voice,
      dna: kit.dna,
    })
    expect(ctx.voiceId).toBe('mock-demo-en')
    expect(ctx.paletteHex[0]).toBe('#2563EB')
    expect(ctx.neverFakeProductChrome).toBe(true)
    expect(ctx.displayName).toBe('Demo')
    expect(toBrandPromptBlock(ctx)).toContain('Do not invent product UI')
    expect(ctx.tagline).toMatch(/cut/i)
    expect(toBrandPromptBlock(ctx)).not.toMatch(/the private example|Hepteract|demoreader/i)
  })

  it('fails closed when kit files are missing', async () => {
    await expect(loadBrandKitFiles('does-not-exist')).rejects.toThrow(/Brand kit incomplete/)
  })
})
