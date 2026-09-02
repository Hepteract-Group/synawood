import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { countUpDisplayed } from './count-up'
import { dialectTokens, resolveBrandTextStyle, sampleDialectAt } from './dialects'
import {
  layoutStageStyle,
  pickArtDirection,
  pickDialect,
  type MotionDialect,
  type MotionLayout,
} from './catalog'
import { sceneWipeProgress, sceneWipeStyle, type MotionTransitionFamily } from './presentations'
import { isBlockedStingerSrc, isStingerLicenseCleared } from './lottie-stinger'
import { audioReactiveFontWeight, audioReactiveScale } from './audio-reactive'
import { deviceOrbitDegrees } from './device-frame'
import { Lottie, type LottieAnimationData } from '@remotion/lottie'
import firstPartyStinger from './fixtures/stinger.json'

export { dialectTokens, resolveBrandTextStyle, sampleDialectAt, DIALECT_TOKENS } from './dialects'
export type { DialectSample, DialectTokens } from './dialects'
export { countUpDisplayed } from './count-up'
export { pickArtDirection, pickDialect, layoutStageStyle } from './catalog'
export { sceneWipeStyle, sceneWipeProgress, MOTION_TRANSITION_FAMILIES } from './presentations'
export type { MotionDialect, MotionLayout } from './catalog'
export type { MotionTransitionFamily } from './presentations'
export { isBlockedStingerSrc, isStingerLicenseCleared } from './lottie-stinger'
export { audioReactiveScale, audioReactiveFontWeight } from './audio-reactive'
export { deviceOrbitDegrees } from './device-frame'

const resolveDialect = (dialect: MotionDialect | undefined, seed: string): MotionDialect =>
  dialect ?? pickDialect({ seed })

const resolveLayout = (layout: MotionLayout | undefined, seed: string): MotionLayout =>
  layout ?? pickArtDirection({ seed }).layout

export const fadeIn = (frame: number, dialect: MotionDialect, duration?: number): number => {
  if (duration === undefined) return sampleDialectAt(dialect, frame).opacity
  return interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

export const slideIn = (frame: number, dialect: MotionDialect, duration?: number): number => {
  const tokens = dialectTokens(dialect)
  if (duration === undefined) return sampleDialectAt(dialect, frame).translateY
  return interpolate(frame, [0, duration], [tokens.slideDistance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

type KitTypeProps = {
  text: string
  color?: string
  dialect: MotionDialect
  layout?: MotionLayout
}

export const KineticType = ({
  text,
  color = '#f4f1ea',
  dialect,
  layout,
}: KitTypeProps): React.ReactElement => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const resolved = resolveDialect(dialect, text)
  const sample = sampleDialectAt(resolved, frame, fps)
  const stage = layoutStageStyle(resolveLayout(layout, text))
  return React.createElement(
    'div',
    {
      style: {
        ...stage,
        color,
        fontSize: sample.headlineSize,
        fontWeight: sample.fontWeight,
        letterSpacing: `${sample.tracking}em`,
        opacity: sample.opacity,
        transform: `translateY(${sample.translateY}px) scale(${0.92 + sample.spring * 0.08})`,
        textAlign: 'center',
      },
    },
    text,
  )
}

export const BrandText = ({
  text,
  color,
  fontSize,
  fontFamily,
  fontWeight,
  dialect,
}: {
  text: string
  color?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number | string
  dialect: MotionDialect
}): React.ReactElement => {
  const resolved = resolveDialect(dialect, text)
  const style = resolveBrandTextStyle({
    dialect: resolved,
    color,
    fontSize,
    fontFamily,
    fontWeight,
  })
  return React.createElement('div', { style }, text)
}

export const CountUp = ({
  value,
  to,
  from = 0,
  durationInFrames,
  label,
  fontSize,
  color,
  fontFamily,
  fontWeight,
  dialect,
}: {
  value?: number
  to?: number
  from?: number
  durationInFrames?: number
  label?: string
  fontSize?: number
  color?: string
  fontFamily?: string
  fontWeight?: number | string
  dialect?: MotionDialect
}): React.ReactElement => {
  const frame = useCurrentFrame()
  const resolved = resolveDialect(dialect, label ?? String(value ?? to ?? 0))
  const tokens = dialectTokens(resolved)
  const duration = durationInFrames ?? tokens.fadeDuration + tokens.slideDuration
  const shown = countUpDisplayed({ frame, value, to, from, durationInFrames: duration })
  const style = resolveBrandTextStyle({
    dialect: resolved,
    color,
    fontSize,
    fontFamily,
    fontWeight,
  })
  return React.createElement('div', { style }, label ? `${shown} ${label}` : String(shown))
}

const resolvePresentation = (
  presentationId: MotionTransitionFamily | undefined,
  seed: string,
): MotionTransitionFamily =>
  presentationId ?? pickArtDirection({ seed }).transitionFamily ?? 'slide'

export const SceneWipe = ({
  children,
  dialect,
  layout,
  presentationId,
  brandColor,
}: {
  children?: React.ReactNode
  dialect: MotionDialect
  layout?: MotionLayout
  presentationId?: MotionTransitionFamily
  brandColor?: string
}): React.ReactElement => {
  const frame = useCurrentFrame()
  const resolved = resolveDialect(dialect, 'scene-wipe')
  const presentation = resolvePresentation(presentationId, dialect)
  const progress = sceneWipeProgress(frame, dialectTokens(resolved).fadeDuration)
  const wipe = sceneWipeStyle({ presentationId: presentation, progress, brandColor })
  return React.createElement(
    'div',
    {
      style: {
        ...layoutStageStyle(resolveLayout(layout, 'scene-wipe')),
        width: '100%',
        height: '100%',
        opacity: wipe.opacity,
        clipPath: wipe.clipPath,
        transform: wipe.transform,
        ...(wipe.backgroundColor ? { backgroundColor: wipe.backgroundColor } : {}),
      },
    },
    children,
  )
}

export const DeviceFrame = ({
  children,
  src,
  brandColor = '#1f6b4a',
  orbit = false,
}: {
  children?: React.ReactNode
  src?: string
  brandColor?: string
  orbit?: boolean
}): React.ReactElement => {
  const frame = useCurrentFrame()
  const yaw = deviceOrbitDegrees(frame, orbit)
  const picture =
    typeof src === 'string' && /^https?:\/\//.test(src)
      ? React.createElement('img', {
          src,
          alt: '',
          style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
        })
      : null
  return React.createElement(
    'div',
    {
      style: {
        perspective: 900,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          border: `12px solid ${brandColor}`,
          borderRadius: 36,
          overflow: 'hidden',
          width: '56%',
          maxWidth: 360,
          aspectRatio: '9 / 19',
          backgroundColor: '#0b0d0c',
          boxShadow: `0 24px 60px ${brandColor}55`,
          transform: `rotateY(${yaw}deg)`,
        },
      },
      children ?? picture,
    ),
  )
}

export const OrbitLogo = ({
  src,
  brandColor = '#1f6b4a',
  children,
}: {
  src?: string
  brandColor?: string
  children?: React.ReactNode
}): React.ReactElement => {
  const frame = useCurrentFrame()
  const yaw = deviceOrbitDegrees(frame, true)
  const mark =
    typeof src === 'string' && /^https?:\/\//.test(src)
      ? React.createElement('img', {
          src,
          alt: '',
          style: { width: 72, height: 72, objectFit: 'contain' },
        })
      : React.createElement('div', {
          style: {
            width: 72,
            height: 72,
            borderRadius: 16,
            backgroundColor: brandColor,
          },
        })
  return React.createElement(
    'div',
    { style: { transform: `rotateY(${yaw}deg)`, transformStyle: 'preserve-3d' } },
    mark,
    children,
  )
}

export const LottieStinger = ({
  src,
  animationData,
  dialect,
  licenseStatus,
  source,
}: {
  src?: string
  animationData?: LottieAnimationData
  dialect?: MotionDialect
  licenseStatus?: string
  source?: string
}): React.ReactElement => {
  const frame = useCurrentFrame()
  const resolved = resolveDialect(dialect, src ?? 'stinger')
  if (src && isBlockedStingerSrc(src)) {
    return React.createElement('div', {
      'data-stinger-blocked': 'giphy',
      title: src,
    })
  }
  if (!isStingerLicenseCleared(licenseStatus, source, src)) {
    return React.createElement('div', { 'data-stinger-blocked': 'license' })
  }
  const data = (animationData ?? firstPartyStinger) as LottieAnimationData
  return React.createElement(Lottie, {
    animationData: data,
    style: {
      width: '100%',
      height: '100%',
      opacity: fadeIn(frame, resolved),
    },
  })
}

export const AudioReactiveCaptions = ({
  text,
  dialect,
  energy,
}: {
  text: string
  dialect?: MotionDialect
  energy?: readonly number[]
}): React.ReactElement => {
  const frame = useCurrentFrame()
  const resolved = resolveDialect(dialect, text)
  const style = resolveBrandTextStyle({ dialect: resolved })
  const scale = audioReactiveScale(energy, frame)
  const fontWeight = audioReactiveFontWeight(energy, frame)
  return React.createElement(
    'div',
    {
      style: {
        ...style,
        fontWeight,
        opacity: fadeIn(frame, resolved),
        transform: `scale(${scale})`,
      },
    },
    text,
  )
}
