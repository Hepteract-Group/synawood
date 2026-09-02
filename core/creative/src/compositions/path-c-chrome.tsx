import React from 'react'
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion'

export type PathCChromeLayout = 'band' | 'outline' | 'stack' | 'split'

/** Stable layout pick so different brands don't share one identical chrome recipe. */
export const pickPathCChromeLayout = (seed: string): PathCChromeLayout => {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const layouts: PathCChromeLayout[] = ['band', 'outline', 'stack', 'split']
  return layouts[Math.abs(hash) % layouts.length]!
}

const parseHex = (hex: string | undefined | null): { r: number; g: number; b: number } | null => {
  if (hex == null || typeof hex !== 'string') return null
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!match) return null
  const n = Number.parseInt(match[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const relativeLuminance = (hex: string | undefined | null): number => {
  const rgb = parseHex(hex)
  if (!rgb) return 0.2
  const lin = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

/** Readable text on a solid brand fill. */
export const inkOn = (background: string | undefined | null): string =>
  relativeLuminance(background) > 0.55 ? '#141414' : '#f4f1ea'

const fadeInOut = (frame: number, duration = 90): number =>
  interpolate(frame, [0, 10, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

export const PathCHookTitle = ({
  text,
  primaryColor,
  accentColor,
  fontFamily,
  layout,
  brandLabel,
}: {
  text: string
  primaryColor: string
  accentColor: string
  fontFamily: string
  layout: PathCChromeLayout
  brandLabel?: string
}) => {
  const frame = useCurrentFrame()
  const opacity = fadeInOut(frame)
  const ink = inkOn(primaryColor)
  const slide = interpolate(frame, [0, 14], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  if (layout === 'outline') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-start', padding: 64, paddingTop: 112 }}>
        <div
          style={{
            opacity,
            transform: `translateY(${slide}px)`,
            color: '#f4f1ea',
            fontFamily,
            maxWidth: '92%',
          }}
        >
          {brandLabel ? (
            <div
              style={{
                fontSize: 28,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: accentColor,
                marginBottom: 12,
                fontWeight: 600,
              }}
            >
              {brandLabel}
            </div>
          ) : null}
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.12 }}>{text}</div>
          <div
            style={{
              marginTop: 18,
              width: 120,
              height: 5,
              background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
            }}
          />
        </div>
      </AbsoluteFill>
    )
  }

  if (layout === 'stack') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 56, paddingBottom: 120 }}>
        <div
          style={{
            opacity,
            transform: `translateY(${slide}px)`,
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 120%)`,
            color: ink,
            fontFamily,
            padding: '28px 32px',
            maxWidth: '94%',
            borderRadius: 4,
            boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
          }}
        >
          {brandLabel ? (
            <div style={{ fontSize: 26, opacity: 0.85, marginBottom: 10, fontWeight: 600 }}>
              {brandLabel}
            </div>
          ) : null}
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.12 }}>{text}</div>
        </div>
      </AbsoluteFill>
    )
  }

  if (layout === 'split') {
    return (
      <AbsoluteFill style={{ flexDirection: 'row' }}>
        <div style={{ width: '28%', background: accentColor, opacity }} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            padding: '120px 48px 64px',
          }}
        >
          <div
            style={{
              opacity,
              transform: `translateX(${slide}px)`,
              background: primaryColor,
              color: ink,
              fontFamily,
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.12,
              padding: '24px 28px',
              maxWidth: '95%',
            }}
          >
            {text}
          </div>
        </div>
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', padding: 64, paddingTop: 120 }}>
      <div
        style={{
          opacity,
          transform: `translateY(${slide}px)`,
          color: ink,
          background: primaryColor,
          fontSize: 60,
          fontWeight: 700,
          fontFamily,
          lineHeight: 1.15,
          padding: '22px 30px',
          maxWidth: '90%',
          outline: `3px solid ${accentColor}`,
          outlineOffset: 6,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  )
}

export const PathCEndCard = ({
  text,
  primaryColor,
  accentColor,
  fontFamily,
  layout,
  brandLabel,
  logoSrc,
}: {
  text: string
  primaryColor: string
  accentColor: string
  fontFamily: string
  layout: PathCChromeLayout
  brandLabel?: string
  logoSrc?: string
}) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const ink = inkOn(primaryColor)

  if (layout === 'split') {
    return (
      <AbsoluteFill style={{ flexDirection: 'row', opacity }}>
        <div
          style={{
            width: '42%',
            background: primaryColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
          }}
        >
          {logoSrc ? (
            <Img src={logoSrc} style={{ width: 140, height: 140, objectFit: 'contain' }} />
          ) : (
            <div
              style={{
                color: ink,
                fontFamily,
                fontSize: 42,
                fontWeight: 700,
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {brandLabel ?? text}
            </div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            background: '#0b0d0c',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: 72,
            gap: 28,
          }}
        >
          <div style={{ width: 72, height: 6, background: accentColor }} />
          <div
            style={{
              color: '#f4f1ea',
              fontFamily,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: 520,
            }}
          >
            {text}
          </div>
        </div>
      </AbsoluteFill>
    )
  }

  if (layout === 'stack' || layout === 'band') {
    return (
      <AbsoluteFill
        style={{
          opacity,
          background: `radial-gradient(120% 80% at 50% 20%, ${primaryColor}33 0%, #0b0d0c 55%)`,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          gap: 36,
        }}
      >
        {logoSrc ? (
          <Img src={logoSrc} style={{ width: 140, height: 140, objectFit: 'contain' }} />
        ) : brandLabel ? (
          <div
            style={{
              color: accentColor,
              fontFamily,
              fontSize: 28,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {brandLabel}
          </div>
        ) : null}
        <div
          style={{
            background: primaryColor,
            color: ink,
            fontFamily,
            fontSize: 48,
            fontWeight: 700,
            padding: '22px 40px',
            borderRadius: 4,
            outline: `3px solid ${accentColor}`,
            outlineOffset: 8,
            textAlign: 'center',
            maxWidth: 860,
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: '#0f1410',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
        gap: 40,
      }}
    >
      {logoSrc ? (
        <Img src={logoSrc} style={{ width: 160, height: 160, objectFit: 'contain' }} />
      ) : null}
      <div
        style={{
          color: '#f4f1ea',
          borderTop: `6px solid ${primaryColor}`,
          borderBottom: `6px solid ${accentColor}`,
          padding: '36px 8px',
          fontSize: 56,
          fontWeight: 700,
          fontFamily,
          textAlign: 'center',
          maxWidth: 900,
        }}
      >
        {text}
      </div>
      {brandLabel ? (
        <div style={{ color: accentColor, fontFamily, fontSize: 28, letterSpacing: '0.06em' }}>
          {brandLabel}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
