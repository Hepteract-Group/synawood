import React from 'react'
import { AbsoluteFill, Audio, Img, Sequence } from 'remotion'
import type { AuthoredAudioClipProps, AuthoredInputProps } from './input-props'
import { parseAuthoredAudioClips } from './input-props'

export type AuthoredPathCWrapProps = Partial<AuthoredInputProps> & {
  children?: React.ReactNode
}

const timelineAudio = (props: AuthoredPathCWrapProps): AuthoredAudioClipProps[] =>
  props.audioClips?.length ? props.audioClips : parseAuthoredAudioClips(props)

/** Path C chrome + timeline audio beds around authored trees — our code, not model TSX. */
export const AuthoredPathCWrap = (props: AuthoredPathCWrapProps): React.ReactElement => {
  const { children, logoSrc, brandLabel, primaryColor = '#1f6b4a', disclaimer } = props
  return React.createElement(
    AbsoluteFill,
    null,
    children,
    ...timelineAudio(props).map((clip, index) =>
      React.createElement(
        Sequence,
        {
          key: `authored-audio-${clip.src}-${clip.from}-${index}`,
          from: clip.from,
          durationInFrames: clip.durationInFrames,
        },
        React.createElement(Audio, {
          src: clip.src,
          trimBefore: clip.trimBefore ?? 0,
          volume: clip.muted ? 0 : 1,
        }),
      ),
    ),
    logoSrc
      ? React.createElement(Img, {
          src: logoSrc,
          style: {
            position: 'absolute',
            top: 28,
            left: 28,
            height: 36,
            width: 'auto',
            objectFit: 'contain',
          },
        })
      : brandLabel
        ? React.createElement(
            'div',
            {
              style: {
                position: 'absolute',
                top: 28,
                left: 28,
                color: primaryColor,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              },
            },
            brandLabel,
          )
        : null,
    disclaimer
      ? React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              left: 28,
              right: 28,
              bottom: 20,
              color: 'rgba(244,241,234,0.7)',
              fontSize: 11,
              lineHeight: 1.35,
            },
          },
          disclaimer,
        )
      : null,
  )
}
