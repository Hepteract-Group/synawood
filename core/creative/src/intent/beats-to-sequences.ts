/** #1201 — creativeStructure beats → timed Sequences (ADR-0034). Client-safe. */

import type {
  ArtDirection,
  BeatLayout,
  BeatSequenceKit,
  MotionDialect,
} from '../motion-kit/catalog'
import { HOOK_LAYOUTS, type HookLayout } from '../motion-kit/catalog'
import type { CreativeBeatKind, CreativeStructure } from './creative-structure'

export type BeatsToSequencesArt = Pick<ArtDirection, 'dialect' | 'layout'> & { seed: string }

const seededIndex = (seed: string, length: number): number => {
  if (length <= 0) return 0
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % length
}

const pickHookLayout = (seed: string, dialect: MotionDialect): HookLayout => {
  const index = seededIndex(`${seed}:${dialect}`, HOOK_LAYOUTS.length)
  return HOOK_LAYOUTS[index]!
}

const KIT_NOTE: Record<
  CreativeBeatKind,
  (hookLayout: HookLayout) => { kit: BeatSequenceKit; note: string }
> = {
  hook: (hookLayout) => {
    if (hookLayout === 'stinger-open') {
      return { kit: 'KineticType', note: 'hook: LottieStinger / dialect entrance' }
    }
    if (hookLayout === 'device-hero') {
      return { kit: 'DeviceFrame', note: 'hook: DeviceFrame entrance' }
    }
    return { kit: 'KineticType', note: 'hook: KineticType full-bleed entrance' }
  },
  education: () => ({ kit: 'KineticType', note: 'education: staggered proof lines' }),
  trust: () => ({ kit: 'CountUp', note: 'trust: CountUp or testimonial plate' }),
  offer: () => ({ kit: 'DeviceFrame', note: 'offer: product / DeviceFrame' }),
  cta: () => ({ kit: 'BrandText', note: 'cta: BrandText + SceneWipe' }),
}

const evenSplit = (
  kinds: Array<CreativeBeatKind | 'fallback'>,
  durationFrames: number,
): Array<{ from: number; durationInFrames: number }> => {
  const count = Math.max(1, kinds.length)
  const base = Math.floor(durationFrames / count)
  const remainder = durationFrames - base * count
  let from = 0
  return kinds.map((_, index) => {
    const durationInFrames = base + (index < remainder ? 1 : 0)
    const row = { from, durationInFrames }
    from += durationInFrames
    return row
  })
}

/**
 * Choreograph authored Sequences from knowledge-graph beats.
 * Empty structure → one type-led scene and emptyStructure=true (Approve still works).
 * `artDirection.seed` is the motionSeed; it is not persisted on beatLayout.
 */
export const beatsToSequences = (
  structure: CreativeStructure,
  artDirection: BeatsToSequencesArt,
  durationFrames: number,
): BeatLayout => {
  const frames = Math.max(1, Math.floor(durationFrames))
  const hookLayout = pickHookLayout(artDirection.seed, artDirection.dialect)
  const beats = structure.beats
  if (beats.length === 0) {
    return {
      emptyStructure: true,
      hookLayout,
      sequences: [
        {
          kind: 'fallback',
          from: 0,
          durationInFrames: frames,
          kit: 'KineticType',
          note: 'empty structure — one-scene type-led fallback; derive_creative_structure if Intent exists',
        },
      ],
    }
  }

  const timedSum = beats.reduce((sum, beat) => sum + beat.durationInFrames, 0)
  const useBeatTimes = timedSum === frames
  const splits = useBeatTimes
    ? beats.map((beat) => ({ from: beat.from, durationInFrames: beat.durationInFrames }))
    : evenSplit(
        beats.map((beat) => beat.kind),
        frames,
      )

  return {
    emptyStructure: false,
    hookLayout,
    sequences: beats.map((beat, index) => {
      const { kit, note } = KIT_NOTE[beat.kind](hookLayout)
      return {
        kind: beat.kind,
        from: splits[index]!.from,
        durationInFrames: splits[index]!.durationInFrames,
        kit,
        note,
      }
    }),
  }
}
