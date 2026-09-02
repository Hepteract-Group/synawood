import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MOTION_DIALECTS, layoutStageStyle, pickDialect } from './catalog'
import { resolveBrandTextStyle, sampleDialectAt } from './dialects'

const kitDir = dirname(fileURLToPath(import.meta.url))

describe('motion dialects (#1191)', () => {
  it('gives each dialect a distinct spring and type hierarchy', () => {
    const springs = new Set<string>()
    const type = new Set<string>()
    for (const dialect of MOTION_DIALECTS) {
      const sample = sampleDialectAt(dialect, 0)
      springs.add(`${sample.stiffness}:${sample.damping}`)
      type.add(
        `${sample.headlineSize}:${sample.proofSize}:${sample.tracking}:${sample.staggerFrames}`,
      )
    }
    expect(springs.size).toBe(6)
    expect(type.size).toBe(6)
  })

  it('samples different motion at frames 0, 8, and 20 for the same copy', () => {
    const at = (frame: number) =>
      MOTION_DIALECTS.map((dialect) => {
        const sample = sampleDialectAt(dialect, frame)
        return `${sample.opacity.toFixed(3)}:${sample.translateY.toFixed(2)}:${sample.spring.toFixed(3)}`
      })

    expect(new Set(at(0)).size).toBe(6)
    expect(new Set(at(8)).size).toBe(6)
    expect(new Set(at(20)).size).toBe(6)
  })

  it('keeps luxury slower and smaller than snappy (rename-only dialects fail)', () => {
    const snappy = sampleDialectAt('snappy', 8)
    const luxury = sampleDialectAt('luxury', 8)
    expect(snappy.headlineSize).toBe(72)
    expect(luxury.headlineSize).toBe(56)
    expect(snappy.stiffness).toBeGreaterThan(luxury.stiffness)
    expect(snappy.proofSize).toBeGreaterThan(luxury.proofSize)
    expect(snappy.opacity).toBeGreaterThan(luxury.opacity)
  })

  it('pickDialect is deterministic and not always snappy', () => {
    expect(pickDialect({ seed: 'alpha' })).toEqual(pickDialect({ seed: 'alpha' }))
    const picked = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => pickDialect({ seed }))
    expect(new Set(picked).size).toBeGreaterThan(1)
    expect(picked.some((dialect) => dialect !== 'snappy')).toBe(true)
  })

  it('BrandText uses passed brand tokens, not a hardcoded green', () => {
    const styled = resolveBrandTextStyle({
      dialect: 'editorial',
      color: '#112233',
      fontFamily: 'Test Serif',
    })
    expect(styled.color).toBe('#112233')
    expect(styled.fontFamily).toBe('Test Serif')
    expect(styled.fontSize).toBe(24)
    expect(styled.color.toLowerCase()).not.toMatch(/#0f0|#00ff|#22c55e|#7dff/)
  })

  it('layouts are not the same centered full-bleed box', () => {
    expect(layoutStageStyle('split-stat').flexDirection).toBe('row')
    expect(layoutStageStyle('stacked-proof').flexDirection).toBe('column')
    expect(layoutStageStyle('full-bleed-type').justifyContent).toBe('center')
    expect(layoutStageStyle('device-hero').padding).toBe(80)
    expect(layoutStageStyle('stinger-open').paddingTop).toBe(96)
  })

  it('kit source has no Math.random and no CSS transitions', () => {
    const files = ['index.ts', 'dialects.ts', 'count-up.ts', 'catalog.ts']
    const blob = files.map((file) => readFileSync(join(kitDir, file), 'utf8')).join('\n')
    expect(blob).not.toMatch(/Math\.random/)
    expect(blob).not.toMatch(/transition\s*:/)
  })
})
