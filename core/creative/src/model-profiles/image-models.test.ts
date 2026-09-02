import { describe, expect, it } from 'vitest'
import {
  canonicalizeImageModelId,
  GATEWAY_IMAGE_MODELS,
  isFrozenImageModelId,
  isGatewayImageModelId,
} from './image-models'

describe('Grok image remap (#1005)', () => {
  it('sends spacexai/grok-imagine-image, not the dead xai/ id', () => {
    const grok = GATEWAY_IMAGE_MODELS.find((row) => row.profileId === 'grok-imagine')
    expect(grok?.gatewayModelId).toBe('spacexai/grok-imagine-image')
    expect(canonicalizeImageModelId('xai/grok-imagine-image')).toBe('spacexai/grok-imagine-image')
    expect(canonicalizeImageModelId('spacexai/grok-imagine-image')).toBe(
      'spacexai/grok-imagine-image',
    )
  })

  it('does not treat an xai/ prefix as a live Gateway image model', () => {
    expect(isGatewayImageModelId('xai/grok-imagine-image')).toBe(true)
    expect(isGatewayImageModelId('xai/not-a-real-model')).toBe(false)
    expect(isGatewayImageModelId('spacexai/grok-imagine-image')).toBe(true)
  })

  it('freezes leftover xai/ ids that have no remap', () => {
    expect(isFrozenImageModelId('xai/grok-imagine-image')).toBe(false)
    expect(isFrozenImageModelId('xai/not-a-real-model')).toBe(true)
    expect(isFrozenImageModelId('spacexai/grok-imagine-image')).toBe(false)
  })
})
