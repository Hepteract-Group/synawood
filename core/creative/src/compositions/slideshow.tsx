import React from 'react'
import { AbsoluteFill, Audio, Sequence } from 'remotion'
import { getStylePack } from '../effects/packs'
import { COMPOSITION_PRESETS } from '../project/schema'
import type { SlideLayout } from '../project/slides'
import { SlideFrame, type SlideFrameProps } from './slide-frame'
import { StylePackProvider } from './style-pack-provider'
import { TrialWatermark } from './trial-watermark'

export type SlideshowSlideProps = {
  headline: string
  body?: string
  layout?: SlideLayout
  backgroundSrc?: string
  durationInFrames: number
  transition: NonNullable<SlideFrameProps['transition']>
}

export type SlideshowCompositionProps = {
  slides: SlideshowSlideProps[]
  voiceoverSrc?: string
  voiceoverMuted?: boolean
  musicSrc?: string
  musicMuted?: boolean
  stylePackId?: string | null
  primaryColor?: string
  accentColor?: string
  fontFamily?: string
  backgroundColor?: string
  defaultCta?: string
  logoSrc?: string
  logoCorner?: SlideFrameProps['logoCorner']
  logoScale?: number
  safeMargins: SlideFrameProps['safeMargins']
  showIndex?: boolean
  /** Mandatory governance disclaimer (ADR-0042). */
  disclaimer?: string
  /** Locale writing direction (ADR-0043). */
  textDirection?: 'ltr' | 'rtl'
  /** Hosted trial plan — burn-in mark on preview and export (#1044). */
  trialWatermark?: boolean
}

export const socialCarouselMeta = COMPOSITION_PRESETS['social-carousel']
export const verticalSlideshowMeta = COMPOSITION_PRESETS['vertical-slideshow']

const EmptySlideshow = ({ fontFamily }: { fontFamily: string }) => (
  <AbsoluteFill
    style={{
      backgroundColor: '#0b0f0c',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#9aa89a',
      fontSize: 36,
      fontFamily,
      textAlign: 'center',
      padding: 48,
    }}
  >
    Add slides to preview the carousel
  </AbsoluteFill>
)

const SlideshowTimeline: React.FC<SlideshowCompositionProps> = ({
  slides,
  voiceoverSrc,
  voiceoverMuted = false,
  musicSrc,
  musicMuted = false,
  stylePackId,
  primaryColor = '#1f6b4a',
  accentColor = '#c45c26',
  fontFamily = 'Georgia, "Times New Roman", serif',
  backgroundColor = '#0f1410',
  defaultCta,
  logoSrc,
  logoCorner = 'top-right',
  logoScale = 1,
  safeMargins,
  showIndex = true,
  disclaimer,
  textDirection = 'ltr',
  trialWatermark = false,
}) => {
  if (slides.length === 0) {
    return <EmptySlideshow fontFamily={fontFamily} />
  }

  const pack = getStylePack(stylePackId)
  let from = 0
  return (
    <AbsoluteFill style={{ backgroundColor, direction: textDirection }}>
      <StylePackProvider pack={pack}>
        {slides.map((slide, index) => {
          const sequenceFrom = from
          from += slide.durationInFrames
          return (
            <Sequence
              key={`slide-${index}-${slide.headline.slice(0, 24)}`}
              from={sequenceFrom}
              durationInFrames={slide.durationInFrames}
            >
              <SlideFrame
                headline={slide.headline}
                body={slide.body}
                layout={slide.layout}
                backgroundSrc={slide.backgroundSrc}
                backgroundColor={backgroundColor}
                primaryColor={primaryColor}
                accentColor={accentColor}
                defaultCta={defaultCta}
                fontFamily={fontFamily}
                logoSrc={logoSrc}
                logoCorner={logoCorner}
                logoScale={logoScale}
                safeMargins={safeMargins}
                transition={slide.transition}
                showIndex={showIndex}
                indexLabel={`${index + 1} / ${slides.length}`}
              />
            </Sequence>
          )
        })}
        {voiceoverSrc ? (
          <Sequence from={0} durationInFrames={Math.max(1, from)}>
            <Audio src={voiceoverSrc} volume={voiceoverMuted ? 0 : 1} />
          </Sequence>
        ) : null}
        {musicSrc ? (
          <Sequence from={0} durationInFrames={Math.max(1, from)}>
            <Audio src={musicSrc} volume={musicMuted ? 0 : voiceoverSrc ? 0.35 : 1} />
          </Sequence>
        ) : null}
      </StylePackProvider>
      {disclaimer ? (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 32px 14px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              color: 'rgba(244,241,234,0.7)',
              fontSize: 16,
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'center',
              maxWidth: '94%',
              lineHeight: 1.3,
            }}
          >
            {disclaimer}
          </div>
        </AbsoluteFill>
      ) : null}
      {trialWatermark ? <TrialWatermark fontFamily={fontFamily} /> : null}
    </AbsoluteFill>
  )
}

/** Instagram / LinkedIn-style still-led carousel as a timed Remotion composition. */
export const SocialCarousel: React.FC<SlideshowCompositionProps> = (props) => (
  <SlideshowTimeline {...props} showIndex={props.showIndex ?? true} />
)

/** TikTok / Reels vertical slideshow with per-slide timing + optional VO. */
export const VerticalSlideshow: React.FC<SlideshowCompositionProps> = (props) => (
  <SlideshowTimeline {...props} showIndex={props.showIndex ?? false} />
)

export const totalSlideshowFrames = (slides: SlideshowSlideProps[]): number => {
  const total = slides.reduce((sum, slide) => {
    const frames = Number(slide.durationInFrames)
    return sum + (Number.isFinite(frames) && frames > 0 ? frames : 1)
  }, 0)
  return Math.max(1, total)
}
