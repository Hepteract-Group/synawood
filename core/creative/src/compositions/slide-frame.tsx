import React from 'react'
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  isCompartmentSlideLayout,
  isSplitSlideLayout,
  isStackedSlideLayout,
  type SlideLayout,
} from '../project/slides'

export type SlideFrameSafeMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

export type SlideFrameProps = {
  headline: string
  body?: string
  layout?: SlideLayout
  backgroundSrc?: string
  backgroundColor?: string
  primaryColor?: string
  accentColor?: string
  captionBg?: string
  defaultCta?: string
  fontFamily?: string
  logoSrc?: string
  logoCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  logoScale?: number
  safeMargins: SlideFrameSafeMargins
  transition?: 'cut' | 'fade' | 'kenBurns'
  /** When true, show slide index badge (carousel authoring). */
  showIndex?: boolean
  indexLabel?: string
}

const LogoBug = ({
  src,
  corner = 'top-right',
  scale = 1,
  safeMargin,
}: {
  src: string
  corner?: SlideFrameProps['logoCorner']
  scale?: number
  safeMargin: number
}) => {
  const size = Math.round(72 * scale)
  const justifyContent = corner?.startsWith('bottom') ? 'flex-end' : 'flex-start'
  const alignItems = corner?.endsWith('left') ? 'flex-start' : 'flex-end'
  return (
    <AbsoluteFill style={{ justifyContent, alignItems, padding: safeMargin }}>
      <Img
        src={src}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          opacity: 0.92,
        }}
      />
    </AbsoluteFill>
  )
}

type LayoutProps = Pick<
  SlideFrameProps,
  | 'headline'
  | 'body'
  | 'backgroundSrc'
  | 'backgroundColor'
  | 'primaryColor'
  | 'accentColor'
  | 'captionBg'
  | 'defaultCta'
  | 'fontFamily'
  | 'safeMargins'
  | 'showIndex'
  | 'indexLabel'
> & { kenScale: number; width: number; height: number }

const IndexBadge: React.FC<{ label: string; pad: number; color?: string }> = ({
  label,
  pad,
  color = 'rgba(255,255,255,0.78)',
}) => (
  <AbsoluteFill
    style={{
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      paddingTop: pad,
      paddingRight: pad,
      pointerEvents: 'none',
    }}
  >
    <div
      style={{
        color,
        fontSize: 16,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </div>
  </AbsoluteFill>
)

const TypeCompartment: React.FC<{
  headline: string
  body?: string
  accentColor: string
  pad: number
  uppercaseHeadline?: boolean
  headlineSize: number
  bodySize: number
}> = ({ headline, body, accentColor, pad, uppercaseHeadline = false, headlineSize, bodySize }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: pad,
      gap: 14,
      minHeight: 0,
      minWidth: 0,
      flex: 1,
    }}
  >
    <div
      style={{
        color: accentColor,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 800,
        fontSize: headlineSize,
        lineHeight: 1.12,
        letterSpacing: uppercaseHeadline ? '0.04em' : '-0.02em',
        textTransform: uppercaseHeadline ? 'uppercase' : undefined,
      }}
    >
      {headline || ' '}
    </div>
    {body ? (
      <div
        style={{
          color: '#f4f1ea',
          fontFamily: 'system-ui, sans-serif',
          fontSize: bodySize,
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        {body}
      </div>
    ) : null}
  </div>
)

const MediaCompartment: React.FC<{
  src?: string
  kenScale: number
  radius?: number
  backgroundColor: string
}> = ({ src, kenScale, radius = 0, backgroundColor }) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      borderRadius: radius,
      overflow: 'hidden',
      backgroundColor,
    }}
  >
    {src ? (
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${kenScale})`,
          transformOrigin: 'center center',
        }}
      />
    ) : null}
  </div>
)

const CompartmentLayout: React.FC<LayoutProps & { layout: SlideLayout }> = ({
  layout,
  headline,
  body,
  backgroundSrc,
  backgroundColor = '#0f1410',
  accentColor = '#c45c26',
  safeMargins,
  kenScale,
  height,
}) => {
  const pad = Math.min(safeMargins.left, safeMargins.right, 36)
  const headlineSize = Math.round(Math.min(isSplitSlideLayout(layout) ? 42 : 48, height * 0.038))
  const bodySize = Math.round(Math.min(26, height * 0.022))
  const stacked = isStackedSlideLayout(layout)
  const mediaFirst = layout === 'stack_media_top' || layout === 'split_media_left'
  const fieldColor = backgroundColor
  const type = (
    <TypeCompartment
      headline={headline}
      body={body}
      accentColor={accentColor}
      pad={pad}
      uppercaseHeadline={layout === 'stack_media_top'}
      headlineSize={headlineSize}
      bodySize={bodySize}
    />
  )
  const media = (
    <MediaCompartment
      src={backgroundSrc}
      kenScale={kenScale}
      radius={layout === 'stack_type_top' ? 20 : 0}
      backgroundColor={fieldColor}
    />
  )
  const mediaWrap =
    layout === 'stack_type_top' ? (
      <div style={{ flex: 1.35, minHeight: 0, padding: `0 ${pad}px ${pad}px`, display: 'flex' }}>
        {media}
      </div>
    ) : (
      media
    )

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        backgroundColor: fieldColor,
      }}
    >
      {mediaFirst ? mediaWrap : type}
      {mediaFirst ? type : mediaWrap}
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// Hero layout — oversized headline, accent kicker bar, centre-bottom text
// ---------------------------------------------------------------------------
const HeroLayout: React.FC<LayoutProps> = ({
  headline,
  body,
  accentColor = '#c45c26',
  fontFamily = 'Georgia, "Times New Roman", serif',
  safeMargins,
  width,
  height,
}) => {
  const contentMaxWidth = Math.min(960, width - safeMargins.left - safeMargins.right)
  const headlineFontSize = Math.round(Math.min(80, height * 0.055))
  const bodyFontSize = Math.round(Math.min(34, height * 0.027))

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        paddingTop: safeMargins.top,
        paddingRight: safeMargins.right,
        paddingBottom: safeMargins.bottom + 24,
        paddingLeft: safeMargins.left,
      }}
    >
      <div style={{ maxWidth: contentMaxWidth, display: 'grid', gap: 20 }}>
        {/* Accent kicker bar */}
        <div
          style={{
            width: 52,
            height: 5,
            backgroundColor: accentColor,
            borderRadius: 3,
          }}
        />
        <div
          style={{
            color: '#f9f6f0',
            fontSize: headlineFontSize,
            fontWeight: 800,
            fontFamily,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 2px 24px rgba(0,0,0,0.6)',
          }}
        >
          {headline || ' '}
        </div>
        {body ? (
          <div
            style={{
              color: 'rgba(249,246,240,0.85)',
              fontSize: bodyFontSize,
              fontFamily,
              lineHeight: 1.4,
              backgroundColor: 'rgba(0,0,0,0.30)',
              padding: '12px 16px',
              borderRadius: 8,
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// Point layout — numbered chip, headline + optional body panel
// ---------------------------------------------------------------------------
const PointLayout: React.FC<LayoutProps & { pointNumber?: number }> = ({
  headline,
  body,
  primaryColor = '#1f6b4a',
  accentColor = '#c45c26',
  captionBg,
  fontFamily = 'Georgia, "Times New Roman", serif',
  safeMargins,
  showIndex,
  indexLabel,
  width,
  height,
  pointNumber,
}) => {
  const contentMaxWidth = Math.min(880, width - safeMargins.left - safeMargins.right)
  const headlineFontSize = Math.round(Math.min(62, height * 0.046))
  const bodyFontSize = Math.round(Math.min(30, height * 0.025))
  const chipSize = Math.round(Math.min(52, height * 0.04))
  const panelBg = captionBg ?? 'rgba(8,12,10,0.52)'

  const chipLabel =
    pointNumber !== undefined
      ? String(pointNumber)
      : showIndex && indexLabel
        ? indexLabel
        : undefined

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        paddingTop: safeMargins.top,
        paddingRight: safeMargins.right,
        paddingBottom: safeMargins.bottom + 16,
        paddingLeft: safeMargins.left,
      }}
    >
      <div style={{ maxWidth: contentMaxWidth, display: 'grid', gap: 16 }}>
        {chipLabel ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: chipSize,
              height: chipSize,
              borderRadius: '50%',
              backgroundColor: accentColor,
              color: '#fff',
              fontSize: Math.round(chipSize * 0.44),
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 800,
            }}
          >
            {chipLabel}
          </div>
        ) : null}
        <div
          style={{
            color: '#f9f6f0',
            fontSize: headlineFontSize,
            fontWeight: 700,
            fontFamily,
            lineHeight: 1.15,
            textShadow: '0 2px 18px rgba(0,0,0,0.5)',
          }}
        >
          {headline || ' '}
        </div>
        {body ? (
          <div
            style={{
              color: 'rgba(249,246,240,0.88)',
              fontSize: bodyFontSize,
              fontFamily,
              lineHeight: 1.45,
              backgroundColor: panelBg,
              padding: '14px 18px',
              borderRadius: 8,
              // Subtle bottom accent — not a side-tab
              boxShadow: `inset 0 -3px 0 0 ${primaryColor}`,
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// Stat layout — oversized accent number, support line below
// ---------------------------------------------------------------------------
const StatLayout: React.FC<LayoutProps> = ({
  headline,
  body,
  accentColor = '#c45c26',
  fontFamily = 'Georgia, "Times New Roman", serif',
  safeMargins,
  width,
  height,
}) => {
  const statFontSize = Math.round(Math.min(140, height * 0.11))
  const supportFontSize = Math.round(Math.min(38, height * 0.03))
  const contentMaxWidth = Math.min(880, width - safeMargins.left - safeMargins.right)

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: safeMargins.top,
        paddingRight: safeMargins.right,
        paddingBottom: safeMargins.bottom,
        paddingLeft: safeMargins.left,
      }}
    >
      <div style={{ maxWidth: contentMaxWidth, display: 'grid', gap: 12 }}>
        <div
          style={{
            color: accentColor,
            fontSize: statFontSize,
            fontWeight: 900,
            fontFamily,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            textShadow: '0 4px 32px rgba(0,0,0,0.7)',
          }}
        >
          {headline || ' '}
        </div>
        {body ? (
          <div
            style={{
              color: 'rgba(249,246,240,0.88)',
              fontSize: supportFontSize,
              fontFamily,
              lineHeight: 1.35,
              letterSpacing: '0.01em',
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// Quote layout — large quotation marks, italic serif headline, attribution
// ---------------------------------------------------------------------------
const QuoteLayout: React.FC<LayoutProps> = ({
  headline,
  body,
  primaryColor = '#1f6b4a',
  accentColor = '#c45c26',
  fontFamily = 'Georgia, "Times New Roman", serif',
  safeMargins,
  width,
  height,
}) => {
  const quoteFontSize = Math.round(Math.min(68, height * 0.05))
  const markFontSize = Math.round(Math.min(160, height * 0.13))
  const attrFontSize = Math.round(Math.min(28, height * 0.022))
  const contentMaxWidth = Math.min(860, width - safeMargins.left - safeMargins.right)

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: safeMargins.top,
        paddingRight: safeMargins.right,
        paddingBottom: safeMargins.bottom,
        paddingLeft: safeMargins.left,
      }}
    >
      <div style={{ maxWidth: contentMaxWidth, position: 'relative' }}>
        {/* Giant decorative open-quote */}
        <div
          style={{
            fontFamily,
            fontSize: markFontSize,
            color: accentColor,
            opacity: 0.35,
            lineHeight: 0.7,
            marginBottom: -24,
            userSelect: 'none',
          }}
        >
          &ldquo;
        </div>
        <div
          style={{
            color: '#f9f6f0',
            fontSize: quoteFontSize,
            fontWeight: 700,
            fontFamily,
            fontStyle: 'italic',
            lineHeight: 1.25,
            textShadow: '0 2px 18px rgba(0,0,0,0.55)',
          }}
        >
          {headline || ' '}
        </div>
        {body ? (
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              color: accentColor,
              fontSize: attrFontSize,
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              // Thin horizontal rule as separator — not a side-tab
              borderTop: `1px solid ${primaryColor}`,
            }}
          >
            {body}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// CTA layout — solid brand primary fill, centred headline, logo lockup
// ---------------------------------------------------------------------------
const CtaLayout: React.FC<LayoutProps & { logoSrc?: string; logoScale?: number }> = ({
  headline,
  body,
  defaultCta,
  primaryColor = '#1f6b4a',
  accentColor = '#c45c26',
  fontFamily = 'Georgia, "Times New Roman", serif',
  safeMargins,
  width,
  height,
  logoSrc,
  logoScale = 1,
}) => {
  const ctaText = headline || defaultCta || 'Get started today'
  const headlineFontSize = Math.round(Math.min(72, height * 0.055))
  const bodyFontSize = Math.round(Math.min(32, height * 0.026))
  const logoSize = Math.round(80 * logoScale)

  return (
    <AbsoluteFill
      style={{
        backgroundColor: primaryColor,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: safeMargins.top,
        paddingRight: safeMargins.right,
        paddingBottom: safeMargins.bottom,
        paddingLeft: safeMargins.left,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          maxWidth: Math.min(880, width - safeMargins.left - safeMargins.right),
          textAlign: 'center',
        }}
      >
        {/* Accent rule above */}
        <div style={{ width: 56, height: 4, backgroundColor: accentColor, borderRadius: 2 }} />
        <div
          style={{
            color: '#ffffff',
            fontSize: headlineFontSize,
            fontWeight: 800,
            fontFamily,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {ctaText}
        </div>
        {body ? (
          <div
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontSize: bodyFontSize,
              fontFamily,
              lineHeight: 1.4,
            }}
          >
            {body}
          </div>
        ) : null}
        {logoSrc ? (
          <Img
            src={logoSrc}
            style={{
              width: logoSize,
              height: logoSize,
              objectFit: 'contain',
              opacity: 0.95,
              marginTop: 8,
            }}
          />
        ) : (
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: accentColor }} />
        )}
      </div>
    </AbsoluteFill>
  )
}

/**
 * Shared Path C slide: brand-bound background + per-layout visual treatment + logo bug.
 * Critical copy is Remotion text — not baked into the diffusion image.
 */
export const SlideFrame: React.FC<SlideFrameProps> = ({
  headline,
  body,
  layout = 'point',
  backgroundSrc,
  backgroundColor = '#0f1410',
  primaryColor = '#1f6b4a',
  accentColor = '#c45c26',
  captionBg,
  defaultCta,
  fontFamily = 'Georgia, "Times New Roman", serif',
  logoSrc,
  logoCorner = 'top-right',
  logoScale = 1,
  safeMargins,
  transition = 'cut',
  showIndex = false,
  indexLabel,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames, width, height } = useVideoConfig()

  const fadeOpacity =
    transition === 'fade'
      ? interpolate(
          frame,
          [0, 8, Math.max(9, durationInFrames - 8), durationInFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
      : 1

  const kenScale =
    transition === 'kenBurns'
      ? interpolate(frame, [0, durationInFrames], [1, 1.08], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1

  // CTA slides: skip photo bg — solid brand fill already applied inside CtaLayout.
  // Compartment layouts place the photo in a cell, not full-bleed under type.
  const useBgImage = Boolean(backgroundSrc) && layout !== 'cta' && !isCompartmentSlideLayout(layout)

  const overlayGradient: Partial<Record<SlideLayout, string>> = {
    hero: 'linear-gradient(180deg, rgba(8,12,10,0.12) 0%, rgba(8,12,10,0.52) 50%, rgba(8,12,10,0.82) 100%)',
    point:
      'linear-gradient(160deg, rgba(8,12,10,0.08) 0%, rgba(8,12,10,0.45) 40%, rgba(8,12,10,0.78) 100%)',
    stat: 'linear-gradient(180deg, rgba(8,12,10,0.25) 0%, rgba(8,12,10,0.65) 100%)',
    quote: 'linear-gradient(180deg, rgba(8,12,10,0.30) 0%, rgba(8,12,10,0.70) 100%)',
  }

  const layoutProps = {
    headline,
    body,
    backgroundSrc,
    backgroundColor,
    primaryColor,
    accentColor,
    captionBg,
    defaultCta,
    fontFamily,
    safeMargins,
    showIndex,
    indexLabel,
    kenScale,
    width,
    height,
  }

  const safeMarginMin = Math.min(safeMargins.top, safeMargins.right, safeMargins.left)

  return (
    <AbsoluteFill style={{ backgroundColor, opacity: fadeOpacity }}>
      {useBgImage && backgroundSrc ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={backgroundSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${kenScale})`,
              transformOrigin: 'center center',
            }}
          />
          {overlayGradient[layout] ? (
            <AbsoluteFill style={{ background: overlayGradient[layout] }} />
          ) : null}
        </AbsoluteFill>
      ) : null}

      {layout === 'hero' ? <HeroLayout {...layoutProps} /> : null}
      {layout === 'point' ? <PointLayout {...layoutProps} /> : null}
      {layout === 'stat' ? <StatLayout {...layoutProps} /> : null}
      {layout === 'quote' ? <QuoteLayout {...layoutProps} /> : null}
      {layout === 'cta' ? (
        <CtaLayout {...layoutProps} logoSrc={logoSrc} logoScale={logoScale} />
      ) : null}
      {isCompartmentSlideLayout(layout) ? (
        <CompartmentLayout {...layoutProps} layout={layout} />
      ) : null}

      {showIndex && indexLabel && layout !== 'cta' ? (
        <IndexBadge
          label={indexLabel}
          pad={Math.min(safeMarginMin, 28)}
          color={
            isCompartmentSlideLayout(layout) ? 'rgba(255,255,255,0.78)' : 'rgba(249,246,240,0.72)'
          }
        />
      ) : null}

      {logoSrc && layout !== 'cta' ? (
        <LogoBug src={logoSrc} corner={logoCorner} scale={logoScale} safeMargin={safeMarginMin} />
      ) : null}
    </AbsoluteFill>
  )
}
