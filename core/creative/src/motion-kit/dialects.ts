import { interpolate, spring } from 'remotion'
import type { MotionDialect } from './catalog'

export type DialectTokens = {
  stiffness: number
  damping: number
  fadeDuration: number
  slideDuration: number
  slideDistance: number
  headlineSize: number
  proofSize: number
  tracking: number
  staggerFrames: number
  fontWeight: number
}

/** Six looks. Copy-paste of snappy into another key fails CI. */
export const DIALECT_TOKENS: Record<MotionDialect, DialectTokens> = {
  snappy: {
    stiffness: 200,
    damping: 12,
    fadeDuration: 8,
    slideDuration: 10,
    slideDistance: 48,
    headlineSize: 72,
    proofSize: 28,
    tracking: -0.04,
    staggerFrames: 2,
    fontWeight: 800,
  },
  luxury: {
    stiffness: 80,
    damping: 22,
    fadeDuration: 20,
    slideDuration: 24,
    slideDistance: 18,
    headlineSize: 56,
    proofSize: 22,
    tracking: 0.12,
    staggerFrames: 8,
    fontWeight: 500,
  },
  editorial: {
    stiffness: 120,
    damping: 18,
    fadeDuration: 14,
    slideDuration: 16,
    slideDistance: 28,
    headlineSize: 64,
    proofSize: 24,
    tracking: 0.02,
    staggerFrames: 5,
    fontWeight: 600,
  },
  comic: {
    stiffness: 280,
    damping: 8,
    fadeDuration: 6,
    slideDuration: 8,
    slideDistance: 64,
    headlineSize: 80,
    proofSize: 32,
    tracking: 0.08,
    staggerFrames: 1,
    fontWeight: 900,
  },
  brutalist: {
    stiffness: 400,
    damping: 40,
    fadeDuration: 4,
    slideDuration: 6,
    slideDistance: 8,
    headlineSize: 88,
    proofSize: 20,
    tracking: -0.08,
    staggerFrames: 0,
    fontWeight: 900,
  },
  'kinetic-stack': {
    stiffness: 160,
    damping: 14,
    fadeDuration: 10,
    slideDuration: 14,
    slideDistance: 40,
    headlineSize: 48,
    proofSize: 40,
    tracking: 0,
    staggerFrames: 6,
    fontWeight: 700,
  },
}

export const dialectTokens = (dialect: MotionDialect): DialectTokens => DIALECT_TOKENS[dialect]

export type DialectSample = DialectTokens & {
  opacity: number
  translateY: number
  spring: number
}

export const sampleDialectAt = (dialect: MotionDialect, frame: number, fps = 30): DialectSample => {
  const tokens = dialectTokens(dialect)
  const delayed = Math.max(0, frame - tokens.staggerFrames)
  return {
    ...tokens,
    opacity: interpolate(delayed, [0, tokens.fadeDuration], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    translateY: interpolate(delayed, [0, tokens.slideDuration], [tokens.slideDistance, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    spring: spring({
      frame: delayed,
      fps,
      config: { stiffness: tokens.stiffness, damping: tokens.damping },
    }),
  }
}

export const resolveBrandTextStyle = (input: {
  dialect: MotionDialect
  color?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | string
}): {
  color: string
  fontSize: number
  fontFamily?: string
  fontWeight: number | string
  letterSpacing: string
} => {
  const tokens = dialectTokens(input.dialect)
  return {
    color: input.color ?? '#f4f1ea',
    fontSize: input.fontSize ?? tokens.proofSize,
    fontFamily: input.fontFamily,
    fontWeight: input.fontWeight ?? tokens.fontWeight,
    letterSpacing: `${tokens.tracking}em`,
  }
}
