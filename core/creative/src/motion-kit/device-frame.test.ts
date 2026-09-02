import { describe, expect, it } from 'vitest'
import { deviceOrbitDegrees } from './device-frame'

describe('DeviceFrame orbit (#1194)', () => {
  it('stays still when orbit is off', () => {
    expect(deviceOrbitDegrees(0, false)).toBe(0)
    expect(deviceOrbitDegrees(45, false)).toBe(0)
  })

  it('yaws from the current frame, not useFrame', () => {
    expect(deviceOrbitDegrees(0, true)).toBe(-10)
    expect(deviceOrbitDegrees(45, true)).toBe(0)
    expect(deviceOrbitDegrees(90, true)).toBe(10)
  })
})
