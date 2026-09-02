import { describe, expect, it } from 'vitest'
import {
  MOTION_TRANSITION_FAMILIES,
  MOTION_DIALECTS,
  MOTION_LAYOUTS,
  HOOK_LAYOUTS,
  motionKitCatalog,
  pickArtDirection,
} from './catalog'

describe('motion kit catalog', () => {
  it('lists all six dialects and five layouts', () => {
    const catalog = motionKitCatalog()
    expect(catalog.dialects).toEqual([...MOTION_DIALECTS])
    expect(catalog.layouts).toEqual([...MOTION_LAYOUTS])
    expect(catalog.dialects).toHaveLength(6)
    expect(catalog.layouts).toHaveLength(5)
    expect(HOOK_LAYOUTS).toEqual(['full-bleed-type', 'stinger-open', 'device-hero'])
    expect(catalog.kitImport).toMatch(/from '@synawood\/creative\/motion-kit'/)
    expect(catalog.allowedImports).toContain('@synawood/creative/motion-kit')
    expect(catalog.allowedImports).toContain('@remotion/lottie')
    expect(catalog.allowedImports).toContain('@remotion/transitions')
    expect(catalog.allowedImports).toContain('@remotion/three')
    expect(catalog.allowedImports).not.toContain('@remotion/motion-kit')
    expect(catalog.components.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'KineticType',
        'CountUp',
        'BrandText',
        'LottieStinger',
        'DeviceFrame',
        'OrbitLogo',
        'SceneWipe',
        'AudioReactiveCaptions',
        'fadeIn',
        'slideIn',
      ]),
    )
    expect(catalog.components.find((row) => row.name === 'CountUp')?.example).toMatch(/to=\{/)
    expect(catalog.components.find((row) => row.name === 'CountUp')?.props).toContain('to')
  })

  it('pickArtDirection is deterministic and not always snappy/full-bleed-type', () => {
    expect(pickArtDirection({ seed: 'alpha' })).toEqual(pickArtDirection({ seed: 'alpha' }))
    const pairs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((seed) =>
      pickArtDirection({ seed }),
    )
    expect(pairs.some((row) => row.dialect !== 'snappy' || row.layout !== 'full-bleed-type')).toBe(
      true,
    )
    expect(new Set(pairs.map((row) => row.dialect)).size).toBeGreaterThan(1)
    expect(MOTION_TRANSITION_FAMILIES).toHaveLength(5)
    expect(pickArtDirection({ seed: 'alpha' }).transitionFamily).toBeDefined()
  })
})
