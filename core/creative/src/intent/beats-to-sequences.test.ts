import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptyCreativeStructure, type CreativeStructure } from './creative-structure'
import { beatsToSequences } from './beats-to-sequences'

const fiveBeats = (): CreativeStructure => ({
  source: 'intent_scenes',
  derivedAt: '2026-08-31T00:00:00.000Z',
  beats: [
    { kind: 'hook', from: 0, durationInFrames: 90 },
    { kind: 'education', from: 90, durationInFrames: 90 },
    { kind: 'trust', from: 180, durationInFrames: 90 },
    { kind: 'offer', from: 270, durationInFrames: 90 },
    { kind: 'cta', from: 360, durationInFrames: 90 },
  ],
})

const art = { dialect: 'editorial' as const, layout: 'split-stat' as const, seed: 'seed-a' }

describe('beatsToSequences (#1201)', () => {
  it('maps hook → education → trust → offer → cta onto timed Sequences', () => {
    const layout = beatsToSequences(fiveBeats(), art, 1800)
    expect(layout.emptyStructure).toBe(false)
    expect(layout.sequences.map((row) => row.kind)).toEqual([
      'hook',
      'education',
      'trust',
      'offer',
      'cta',
    ])
    expect(layout.sequences[0]?.kit).toMatch(/KineticType|DeviceFrame/)
    expect(layout.sequences[1]?.kit).toBe('KineticType')
    expect(layout.sequences[2]?.kit).toBe('CountUp')
    expect(layout.sequences[3]?.kit).toBe('DeviceFrame')
    expect(layout.sequences[4]?.kit).toBe('BrandText')
    const last = layout.sequences.at(-1)!
    expect(last.from + last.durationInFrames).toBe(1800)
    expect(layout.sequences[0]?.from).toBe(0)
  })

  it('even-splits durationFrames when beat times do not cover the ad', () => {
    const layout = beatsToSequences(fiveBeats(), art, 1800)
    expect(layout.sequences.every((row) => row.durationInFrames === 360)).toBe(true)
  })

  it('returns a one-scene fallback when structure is empty', () => {
    const layout = beatsToSequences(emptyCreativeStructure(), art, 1800)
    expect(layout.emptyStructure).toBe(true)
    expect(layout.sequences).toHaveLength(1)
    expect(layout.sequences[0]?.kind).toBe('fallback')
    expect(layout.sequences[0]?.from).toBe(0)
    expect(layout.sequences[0]?.durationInFrames).toBe(1800)
    expect(layout.sequences[0]?.kit).toBe('KineticType')
  })

  it('picks different hook layouts for two seeds with the same beats', () => {
    const hooks = new Set(
      ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f', 'seed-g', 'seed-h'].map(
        (seed) => beatsToSequences(fiveBeats(), { ...art, seed }, 1800).hookLayout,
      ),
    )
    expect(hooks.size).toBeGreaterThan(1)
    const again = beatsToSequences(fiveBeats(), art, 1800)
    expect(again.hookLayout).toBe(beatsToSequences(fiveBeats(), art, 1800).hookLayout)
  })

  it('keeps stored beat times when they already cover durationFrames', () => {
    const layout = beatsToSequences(fiveBeats(), art, 450)
    expect(layout.sequences.map((row) => row.from)).toEqual([0, 90, 180, 270, 360])
    expect(layout.sequences.every((row) => row.durationInFrames === 90)).toBe(true)
  })

  it('does not import Neo4j', () => {
    const source = readFileSync(join(__dirname, 'beats-to-sequences.ts'), 'utf8')
    expect(source).not.toMatch(/neo4j|Neo4j/)
  })
})
