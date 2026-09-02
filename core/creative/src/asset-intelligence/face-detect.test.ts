import { describe, expect, it } from 'vitest'
import { isAssetFaceDetectEnabled, runFaceDetectPass } from './face-detect'

describe('isAssetFaceDetectEnabled', () => {
  it('is off by default', () => {
    expect(isAssetFaceDetectEnabled({})).toBe(false)
    expect(isAssetFaceDetectEnabled({ ASSET_FACE_DETECT: 'false' })).toBe(false)
    expect(isAssetFaceDetectEnabled({ ASSET_FACE_DETECT: '1' })).toBe(false)
  })

  it('is on only when ASSET_FACE_DETECT=true', () => {
    expect(isAssetFaceDetectEnabled({ ASSET_FACE_DETECT: 'true' })).toBe(true)
  })
})

describe('runFaceDetectPass', () => {
  it('does not mark ran when disabled', () => {
    expect(runFaceDetectPass({ enabled: false, kind: 'video' })).toEqual({
      ran: false,
      faceCount: 0,
      skippedReason: 'ASSET_FACE_DETECT is off (default)',
    })
  })

  it('marks ran for image/video when enabled without inventing identities', () => {
    expect(runFaceDetectPass({ enabled: true, kind: 'image' })).toEqual({
      ran: true,
      faceCount: 0,
    })
    expect(runFaceDetectPass({ enabled: true, kind: 'video' }).ran).toBe(true)
  })

  it('marks ran with zero faces for audio', () => {
    const result = runFaceDetectPass({ enabled: true, kind: 'audio' })
    expect(result.ran).toBe(true)
    expect(result.faceCount).toBe(0)
  })
})
