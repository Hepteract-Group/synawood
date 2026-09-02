import { describe, expect, it } from 'vitest'
import { LEGAL_KIT_FIXTURE } from './fixtures'
import {
  patchAuthoredComposition,
  setAuthoredMotionSeed,
  writeAuthoredComposition,
} from './write-composition'
import { createEmptyProject } from '../project/schema'

const talkingHead = () =>
  createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })

describe('writeAuthoredComposition', () => {
  it('sets authored id, stores source, and compiles green', () => {
    const { project, compile } = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-write-1',
      artDirection: { dialect: 'editorial', layout: 'split-stat' },
    })
    expect(compile.ok).toBe(true)
    expect(project.compositionId).toBe('authored')
    expect(project.compositionSource?.source).toBe(LEGAL_KIT_FIXTURE)
    expect(project.compositionSource?.motionSeed).toBe('seed-write-1')
    expect(project.compositionSource?.artDirection).toMatchObject({
      dialect: 'editorial',
      layout: 'split-stat',
      transitionFamily: 'slide',
    })
    expect(project.compositionSource?.artDirection?.beatLayout?.emptyStructure).toBe(true)
    expect(project.compositionSource?.compileError).toBeNull()
  })

  it('saves illegal source and records compileError', () => {
    const source = `import fs from 'node:fs'\nexport default () => null\n`
    const { project, compile } = writeAuthoredComposition(talkingHead(), { source })
    expect(compile.ok).toBe(false)
    expect(project.compositionSource?.source).toBe(source)
    expect(project.compositionSource?.compileError).toMatch(/Line 1/)
    expect(project.compositionSource?.compileError).toMatch(/node:fs/)
  })

  it('picks artDirection from seed when omitted', () => {
    const { project } = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-variety-9',
    })
    expect(project.compositionSource?.artDirection?.dialect).toBeTruthy()
    expect(project.compositionSource?.artDirection?.layout).toBeTruthy()
  })

  it('skips recent dialect|layout pairs when picking', () => {
    const recent = ['snappy|full-bleed-type|stored']
    const { project } = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-variety-9',
      recentFingerprints: recent,
    })
    const pair = `${project.compositionSource?.artDirection?.dialect}|${project.compositionSource?.artDirection?.layout}`
    expect(pair).not.toBe('snappy|full-bleed-type')
  })

  it('allows repeating a recent pair when sequel is true', () => {
    const baseline = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-sequel-1',
    }).project.compositionSource?.artDirection
    const { project } = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-sequel-1',
      recentFingerprints: [`${baseline?.dialect}|${baseline?.layout}|stored`],
      sequel: true,
    })
    expect(project.compositionSource?.artDirection).toEqual(baseline)
  })

  it('fails closed when CountUp is not in Catalog/DNA (#1199)', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      "import { KineticType } from '@synawood/creative/motion-kit'",
      "import { CountUp, KineticType } from '@synawood/creative/motion-kit'",
    ).replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      '<CountUp value={1000000} label="users" />',
    )
    const { project, compile } = writeAuthoredComposition(talkingHead(), { source })
    expect(compile.ok).toBe(false)
    expect(project.compositionSource?.compileError).toMatch(/1000000/)
    expect(project.compositionSource?.compileError).toMatch(/Catalog\/DNA/)
  })

  it('accepts CountUp bound to a catalog proofStat (#1199)', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      "import { KineticType } from '@synawood/creative/motion-kit'",
      "import { CountUp, KineticType } from '@synawood/creative/motion-kit'",
    ).replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      '<CountUp value={40} label="hours" />',
    )
    const base = talkingHead()
    const { compile } = writeAuthoredComposition(
      {
        ...base,
        brand: {
          productId: 'demo',
          displayName: 'the private example',
          proofStats: [{ value: 40, unit: 'hours', source: 'catalog', claimId: 'hours-back' }],
        },
      },
      { source },
    )
    expect(compile.ok).toBe(true)
  })

  it('persists beatLayout Sequences from creativeStructure (#1201)', () => {
    const base = talkingHead()
    const { project } = writeAuthoredComposition(
      {
        ...base,
        creativeStructure: {
          source: 'intent_scenes',
          beats: [
            { kind: 'hook', from: 0, durationInFrames: 90 },
            { kind: 'education', from: 90, durationInFrames: 90 },
            { kind: 'trust', from: 180, durationInFrames: 90 },
            { kind: 'offer', from: 270, durationInFrames: 90 },
            { kind: 'cta', from: 360, durationInFrames: 90 },
          ],
        },
      },
      {
        source: LEGAL_KIT_FIXTURE,
        motionSeed: 'seed-beats-1',
        artDirection: { dialect: 'editorial', layout: 'split-stat' },
      },
    )
    const layout = project.compositionSource?.artDirection?.beatLayout
    expect(layout?.emptyStructure).toBe(false)
    expect(layout?.sequences.map((row) => row.kind)).toEqual([
      'hook',
      'education',
      'trust',
      'offer',
      'cta',
    ])
  })
})

describe('patchAuthoredComposition', () => {
  it('search-replaces and recompiles', () => {
    const written = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-patch-1',
    }).project
    const patched = patchAuthoredComposition(written, {
      find: "text={'Frame '",
      replace: "text={'Beat '",
    })
    expect(patched.ok).toBe(true)
    if (!patched.ok) return
    expect(patched.project.compositionSource?.source).toContain("text={'Beat '")
    expect(patched.project.compositionSource?.source).toContain('useCurrentFrame')
    expect(patched.project.compositionSource?.source).not.toContain("text={'Frame '")
    expect(patched.compile.ok).toBe(true)
  })

  it('fails closed when find is missing', () => {
    const written = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
    }).project
    const patched = patchAuthoredComposition(written, {
      find: 'not-in-source',
      replace: 'x',
    })
    expect(patched).toMatchObject({ ok: false })
  })
})

describe('setAuthoredMotionSeed', () => {
  it('changes seed without wiping source', () => {
    const written = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-old',
      artDirection: { dialect: 'snappy', layout: 'full-bleed-type' },
    }).project
    const next = setAuthoredMotionSeed(written, { motionSeed: 'seed-new' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.project.compositionSource?.source).toBe(LEGAL_KIT_FIXTURE)
    expect(next.project.compositionSource?.motionSeed).toBe('seed-new')
    expect(next.project.compositionSource?.artDirection).toBeDefined()
  })

  it('may change dialect when the seed changes', () => {
    const written = writeAuthoredComposition(talkingHead(), {
      source: LEGAL_KIT_FIXTURE,
      motionSeed: 'seed-old',
    }).project
    const original = written.compositionSource?.artDirection?.dialect
    const dialects = new Set<string>()
    if (original) dialects.add(original)
    for (const seed of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']) {
      const next = setAuthoredMotionSeed(written, { motionSeed: seed })
      if (!next.ok) continue
      const dialect = next.project.compositionSource?.artDirection?.dialect
      if (dialect) dialects.add(dialect)
    }
    expect(dialects.size).toBeGreaterThan(1)
  })
})
