import { AUTHORED_IMPORT_ALLOWLIST } from '../authored/allowlist'
import { MOTION_TRANSITION_FAMILIES, type MotionTransitionFamily } from './presentations'

export { MOTION_TRANSITION_FAMILIES }
export type { MotionTransitionFamily } from './presentations'

/** Names, props, and examples for `list_motion_kit`. Beauty of each dialect is #1184. */

export const MOTION_DIALECTS = [
  'snappy',
  'luxury',
  'editorial',
  'comic',
  'brutalist',
  'kinetic-stack',
] as const

export type MotionDialect = (typeof MOTION_DIALECTS)[number]

export const MOTION_LAYOUTS = [
  'full-bleed-type',
  'split-stat',
  'stacked-proof',
  'device-hero',
  'stinger-open',
] as const

export type MotionLayout = (typeof MOTION_LAYOUTS)[number]

/** Hook Sequence variety — not always the same layout for the same five beats. */
export const HOOK_LAYOUTS = ['full-bleed-type', 'stinger-open', 'device-hero'] as const
export type HookLayout = (typeof HOOK_LAYOUTS)[number]

export type BeatSequenceKit = 'KineticType' | 'CountUp' | 'DeviceFrame' | 'BrandText'

export type BeatSequencePlan = {
  kind: 'hook' | 'education' | 'trust' | 'offer' | 'cta' | 'fallback'
  from: number
  durationInFrames: number
  kit: BeatSequenceKit
  note: string
}

export type BeatLayout = {
  emptyStructure: boolean
  hookLayout: HookLayout
  sequences: BeatSequencePlan[]
}

export type ArtDirection = {
  dialect: MotionDialect
  layout: MotionLayout
  transitionFamily?: MotionTransitionFamily
  stingerLibraryItemId?: string
  beatLayout?: BeatLayout
}

export type MotionKitComponent = {
  name: string
  props: string[]
  example: string
}

export const MOTION_KIT_IMPORT =
  "import { KineticType, BrandText, CountUp, fadeIn, slideIn, SceneWipe, DeviceFrame, OrbitLogo, LottieStinger, AudioReactiveCaptions } from '@synawood/creative/motion-kit'"

export type MotionKitCatalog = {
  dialects: readonly MotionDialect[]
  layouts: readonly MotionLayout[]
  components: readonly MotionKitComponent[]
  allowedImports: readonly string[]
  kitImport: string
}

/**
 * Value exports from `motion-kit/index.ts`. Remotion-free name list so
 * `compileAuthoredComposition` can reject unknown imports without loading Remotion
 * (chat / API routes must not evaluate `useCurrentFrame`).
 */
export const MOTION_KIT_VALUE_EXPORTS = [
  'KineticType',
  'BrandText',
  'CountUp',
  'fadeIn',
  'slideIn',
  'SceneWipe',
  'DeviceFrame',
  'OrbitLogo',
  'LottieStinger',
  'AudioReactiveCaptions',
  'dialectTokens',
  'resolveBrandTextStyle',
  'sampleDialectAt',
  'DIALECT_TOKENS',
  'countUpDisplayed',
  'pickArtDirection',
  'pickDialect',
  'layoutStageStyle',
  'sceneWipeStyle',
  'MOTION_TRANSITION_FAMILIES',
  'audioReactiveScale',
  'deviceOrbitDegrees',
] as const

export const MOTION_KIT_COMPONENTS: readonly MotionKitComponent[] = [
  {
    name: 'KineticType',
    props: ['text', 'color', 'dialect', 'layout'],
    example: `<KineticType dialect="editorial" text="Still juggling PDFs?" color="#f4f1ea" />`,
  },
  {
    name: 'BrandText',
    props: ['text', 'color', 'fontSize', 'fontFamily', 'dialect'],
    example: `<BrandText dialect="editorial" text="the private example" color={props.brandColor} fontFamily={props.brandFont} />`,
  },
  {
    name: 'CountUp',
    props: ['value', 'to', 'from', 'durationInFrames', 'label', 'dialect'],
    example: `<CountUp dialect="editorial" to={40} from={0} durationInFrames={30} label="hours saved" />`,
  },
  {
    name: 'fadeIn',
    props: ['frame', 'dialect', 'duration'],
    example: `const opacity = fadeIn(frame, 'snappy')`,
  },
  {
    name: 'slideIn',
    props: ['frame', 'dialect', 'duration'],
    example: `const y = slideIn(frame, 'snappy')`,
  },
  {
    name: 'SceneWipe',
    props: ['children', 'dialect', 'presentationId', 'brandColor'],
    example: `<SceneWipe presentationId="iris" dialect="editorial"><KineticType dialect="editorial" text="Next beat" /></SceneWipe>`,
  },
  {
    name: 'DeviceFrame',
    props: ['children', 'src', 'brandColor', 'orbit'],
    example: `<DeviceFrame src={props.productUrl} brandColor={props.primaryColor} orbit><BrandText text="App screen" /></DeviceFrame>`,
  },
  {
    name: 'OrbitLogo',
    props: ['src', 'brandColor'],
    example: `<OrbitLogo src={props.logoUrl} brandColor={props.primaryColor} />`,
  },
  {
    name: 'LottieStinger',
    props: ['src', 'animationData', 'licenseStatus'],
    example: `<LottieStinger src={props.stingerUrl} animationData={props.stingerData} />`,
  },
  {
    name: 'AudioReactiveCaptions',
    props: ['text', 'energy', 'dialect'],
    example: `<AudioReactiveCaptions dialect="snappy" text="Edit without Adobe" energy={props.audioEnergy} />`,
  },
]

export const motionKitCatalog = (): MotionKitCatalog => ({
  dialects: MOTION_DIALECTS,
  layouts: MOTION_LAYOUTS,
  components: MOTION_KIT_COMPONENTS,
  allowedImports: [...AUTHORED_IMPORT_ALLOWLIST],
  kitImport: MOTION_KIT_IMPORT,
})

const fnv1a = (value: string): number => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const allArtDirectionPairs = (): ArtDirection[] => {
  const pairs: ArtDirection[] = []
  for (const dialect of MOTION_DIALECTS) {
    for (const layout of MOTION_LAYOUTS) {
      for (const transitionFamily of MOTION_TRANSITION_FAMILIES) {
        pairs.push({ dialect, layout, transitionFamily })
      }
    }
  }
  return pairs
}

/** Deterministic pick. Never hardcodes snappy + full-bleed-type. */
export const pickDialect = (input: { seed: string; brandMood?: string }): MotionDialect => {
  const hash = fnv1a(`${input.seed}:${input.brandMood ?? ''}`)
  return MOTION_DIALECTS[hash % MOTION_DIALECTS.length]!
}

export const pickArtDirection = (input: {
  seed: string
  brandMood?: string
  recentFingerprints?: readonly string[]
  sequel?: boolean
}): ArtDirection => {
  const all = allArtDirectionPairs()
  const recentPairs = new Set(
    (input.recentFingerprints ?? []).slice(0, 5).map((fingerprint) => {
      const [dialect, layout] = fingerprint.split('|')
      return `${dialect}|${layout}`
    }),
  )
  let pool = all
  if (!input.sequel && recentPairs.size > 0) {
    const filtered = all.filter((pair) => !recentPairs.has(`${pair.dialect}|${pair.layout}`))
    if (filtered.length > 0) pool = filtered
  }
  const hash = fnv1a(`${input.seed}:${input.brandMood ?? ''}`)
  return pool[hash % pool.length]!
}

export const LAYOUT_STAGE_STYLE: Record<MotionLayout, Record<string, string | number>> = {
  'full-bleed-type': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 48,
  },
  'split-stat': {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    width: '100%',
    padding: 48,
  },
  'stacked-proof': {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    gap: 16,
    width: '100%',
    padding: 64,
  },
  'device-hero': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 80,
  },
  'stinger-open': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: 96,
  },
}

export const layoutStageStyle = (layout: MotionLayout): Record<string, string | number> =>
  LAYOUT_STAGE_STYLE[layout]
