import React from 'react'
import { AbsoluteFill, Img } from 'remotion'
import { SlideFrame, type SlideFrameSafeMargins } from './slide-frame'
import { TrialWatermark } from './trial-watermark'

export const campaignPackStillMeta = {
  id: 'campaign-pack-still',
  fps: 30,
  width: 1080,
  height: 1080,
  /** Single still frame — Animate/motion is #113. */
  durationInFrames: 1,
} as const

export type CampaignPackStillProps = {
  headline: string
  body?: string
  cta?: string
  backgroundSrc?: string
  backgroundColor?: string
  primaryColor?: string
  accentColor?: string
  fontFamily?: string
  logoSrc?: string
  logoCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  logoScale?: number
  safeMargins?: SlideFrameSafeMargins
  trialWatermark?: boolean
}

const DEFAULT_MARGINS: SlideFrameSafeMargins = { top: 64, right: 64, bottom: 96, left: 64 }

/**
 * Square Path C still for Campaign packs (#109).
 * One creative per render selection; pack export loops creatives in later slices.
 */
export const CampaignPackStill: React.FC<CampaignPackStillProps> = ({
  headline,
  body,
  cta,
  backgroundSrc,
  backgroundColor = '#0f1410',
  primaryColor = '#1f6b4a',
  accentColor = '#c45c26',
  fontFamily = 'Georgia, "Times New Roman", serif',
  logoSrc,
  logoCorner = 'top-right',
  logoScale = 1,
  safeMargins = DEFAULT_MARGINS,
  trialWatermark = false,
}) => (
  <AbsoluteFill style={{ backgroundColor }}>
    {backgroundSrc ? (
      <Img src={backgroundSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : null}
    <SlideFrame
      headline={headline || 'Your headline'}
      body={body}
      layout="cta"
      backgroundSrc={undefined}
      backgroundColor="transparent"
      primaryColor={primaryColor}
      accentColor={accentColor}
      defaultCta={cta}
      fontFamily={fontFamily}
      logoSrc={logoSrc}
      logoCorner={logoCorner}
      logoScale={logoScale}
      safeMargins={safeMargins}
      transition="cut"
    />
    {trialWatermark ? <TrialWatermark fontFamily={fontFamily} /> : null}
  </AbsoluteFill>
)
