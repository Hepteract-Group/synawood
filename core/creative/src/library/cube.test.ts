import { describe, expect, it } from 'vitest'
import {
  CUBE_LUT_MAX_SIZE,
  cubeLutChannelCurves,
  cubeLutToCssFilter,
  isCubeLut,
  parseCubeLut,
} from './cube'

const identity2 = `# identity
TITLE "Identity 2"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`

describe('parseCubeLut (#720)', () => {
  it('parses an identity 2³ LUT', () => {
    const lut = parseCubeLut(identity2)
    expect(lut.type).toBe('cube_lut')
    expect(lut.title).toBe('Identity 2')
    expect(lut.size).toBe(2)
    expect(lut.table).toHaveLength(24)
    expect(isCubeLut(lut)).toBe(true)
  })

  it('rejects 1D cubes and oversize 3D cubes', () => {
    expect(() => parseCubeLut('LUT_1D_SIZE 16\n0 0 0\n')).toThrow(/1D/)
    expect(() => parseCubeLut(`LUT_3D_SIZE ${CUBE_LUT_MAX_SIZE + 1}\n`)).toThrow(/2 to 32/)
  })

  it('rejects a short table', () => {
    expect(() => parseCubeLut('LUT_3D_SIZE 2\n0 0 0\n')).toThrow(/Expected 8 RGB rows/)
  })

  it('samples identity curves as a ramp', () => {
    const lut = parseCubeLut(identity2)
    const curves = cubeLutChannelCurves(lut, 3)
    expect(curves.r[0]).toBe(0)
    expect(curves.r[2]).toBe(1)
    expect(cubeLutToCssFilter(lut)).toMatch(/feComponentTransfer/)
    expect(cubeLutToCssFilter(lut, 0)).toBe('none')
  })
})
