import React from 'react'
import { Composition } from 'remotion'
import { TalkingHead60, talkingHeadMeta, type TalkingHeadProps } from './talking-head-60'
import {
  SocialCarousel,
  VerticalSlideshow,
  socialCarouselMeta,
  verticalSlideshowMeta,
  type SlideshowCompositionProps,
} from './slideshow'
import {
  CampaignPackStill,
  campaignPackStillMeta,
  type CampaignPackStillProps,
} from './campaign-pack-still'

export const defaultTalkingHeadProps: TalkingHeadProps = {
  clips: [],
  hookTitle: 'Your hook',
  endCard: 'example.com',
  primaryColor: '#1f6b4a',
}

const defaultSafeMargins = { top: 64, right: 64, bottom: 64, left: 64 }

export const defaultSlideshowProps: SlideshowCompositionProps = {
  slides: [
    {
      headline: 'Edit PDFs without Adobe',
      durationInFrames: 90,
      transition: 'cut',
    },
    {
      headline: 'Open in your browser',
      durationInFrames: 90,
      transition: 'fade',
    },
    {
      headline: 'Share in one tap',
      durationInFrames: 90,
      transition: 'kenBurns',
    },
  ],
  primaryColor: '#1f6b4a',
  accentColor: '#c45c26',
  safeMargins: defaultSafeMargins,
}

export const defaultCampaignPackStillProps: CampaignPackStillProps = {
  headline: 'Edit PDFs without Adobe',
  cta: 'Try free',
  primaryColor: '#1f6b4a',
  accentColor: '#c45c26',
  safeMargins: { top: 64, right: 64, bottom: 96, left: 64 },
}

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="talking-head-60"
      component={TalkingHead60}
      durationInFrames={talkingHeadMeta.durationFrames}
      fps={talkingHeadMeta.fps}
      width={talkingHeadMeta.width}
      height={talkingHeadMeta.height}
      defaultProps={defaultTalkingHeadProps}
    />
    <Composition
      id="social-carousel"
      component={SocialCarousel}
      durationInFrames={socialCarouselMeta.durationFrames}
      fps={socialCarouselMeta.fps}
      width={socialCarouselMeta.width}
      height={socialCarouselMeta.height}
      defaultProps={defaultSlideshowProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(
          1,
          props.slides.reduce((sum, slide) => sum + slide.durationInFrames, 0),
        ),
      })}
    />
    <Composition
      id="vertical-slideshow"
      component={VerticalSlideshow}
      durationInFrames={verticalSlideshowMeta.durationFrames}
      fps={verticalSlideshowMeta.fps}
      width={verticalSlideshowMeta.width}
      height={verticalSlideshowMeta.height}
      defaultProps={{
        ...defaultSlideshowProps,
        safeMargins: { top: 160, right: 48, bottom: 220, left: 48 },
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(
          1,
          props.slides.reduce((sum, slide) => sum + slide.durationInFrames, 0),
        ),
      })}
    />
    <Composition
      id="campaign-pack-still"
      component={CampaignPackStill}
      durationInFrames={campaignPackStillMeta.durationInFrames}
      fps={campaignPackStillMeta.fps}
      width={campaignPackStillMeta.width}
      height={campaignPackStillMeta.height}
      defaultProps={defaultCampaignPackStillProps}
    />
  </>
)
