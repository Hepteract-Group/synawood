import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { activeCaptionWordIndex } from '../overlays/caption-styles'
import { getStylePack } from '../effects/packs'
import {
  DEFAULT_PIP_LAYOUT,
  layoutRegions,
  normalizePipLayout,
  type LayoutRect,
  type PipLayout,
} from '../project/pip-layout'
import { COMPOSITION_PRESETS } from '../project/schema'
import { PathCEndCard, PathCHookTitle, pickPathCChromeLayout } from './path-c-chrome'
import { StylePackProvider } from './style-pack-provider'
import { CubeLutProvider } from './cube-lut-provider'
import { TreatmentProvider } from './treatment-provider'
import { TrialWatermark } from './trial-watermark'
import type { CubeLut } from '../library/cube'
import { gainAtEnvelope } from '../audio/duck-music'
import { interpolateTracking, panScanStyle } from '../video/reframe-clip'

export type TalkingHeadClipProps = {
  src: string
  from: number
  durationInFrames: number
  trimBefore?: number
  /** Timeline media kind — stills use Img, footage uses Video, VO uses Audio. */
  mediaKind?: 'video' | 'image' | 'audio'
  /** When true, Remotion volume is 0 (track muted). */
  muted?: boolean
  /** Clip-level grade; overrides project.stylePackId on these frames. */
  filterId?: string | null
  filterIntensity?: number
  /** Imported .cube LUT (#720). Takes over CSS filter when set. */
  cubeLut?: CubeLut | null
  treatments?: { id: string; intensity: number; from?: number; durationInFrames?: number }[]
  /** Clip-local music volume keys (duck_music). */
  volumeEnvelope?: { atFrame: number; gain: number }[]
  /** Subject-tracking pan/scan (ADR-0074). */
  reframe?: {
    aspect: string
    tracking: { t: number; x: number; y: number; w: number; h: number }[]
  }
}

export type TalkingHeadCaption = {
  text: string
  from: number
  durationInFrames: number
  presetId?: 'band' | 'two-line' | 'word-highlight' | 'karaoke'
  words?: { text: string; startMs: number; endMs: number }[]
  emphasis?: number[]
  marks?: { wordIndex: number; src: string }[]
}

export type TalkingHeadTextOverlay = {
  id: string
  kind: 'title' | 'lower_third'
  text: string
  from: number
  durationInFrames: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  align?: 'left' | 'center' | 'right'
  fill?: string
  fontSizeEm?: number
}

export type TalkingHeadSticker = {
  id: string
  src: string
  from: number
  durationInFrames: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

/** @deprecated Use PipLayout from `@synawood/creative/project/pip-layout`. */
export type TalkingHeadPipLayout = PipLayout

export { DEFAULT_PIP_LAYOUT }

export type TalkingHeadProps = {
  clips: TalkingHeadClipProps[]
  /** B-roll / PiP lane (ADR-0046). */
  pipClips?: TalkingHeadClipProps[]
  /** Inset or split layout for B-roll (ADR-0046). */
  pipLayout?: PipLayout
  /** First-party look pack (ADR-0045). */
  stylePackId?: string | null
  hookTitle?: string
  endCard?: string
  /** When set, end card starts here instead of (composition duration − 90). */
  endCardFrom?: number
  endCardDurationInFrames?: number
  captions?: TalkingHeadCaption[]
  textOverlays?: TalkingHeadTextOverlay[]
  stickers?: TalkingHeadSticker[]
  primaryColor?: string
  accentColor?: string
  captionBg?: string
  fontFamily?: string
  /** Path C — guaranteed logo overlay from project brand. */
  logoSrc?: string
  logoCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  logoScale?: number
  logoSafeMargin?: number
  /** Short brand name for Path C chrome variants. */
  brandLabel?: string
  /** Mandatory governance disclaimer (ADR-0042). */
  disclaimer?: string
  /** Locale writing direction (ADR-0043). */
  textDirection?: 'ltr' | 'rtl'
  /** Hosted trial plan — burn-in mark on preview and export (#1044). */
  trialWatermark?: boolean
}

export const talkingHeadMeta = COMPOSITION_PRESETS['talking-head-60']

const TextOverlayLayer = ({
  overlay,
  fontFamily,
  fallbackFill,
}: {
  overlay: TalkingHeadTextOverlay
  fontFamily: string
  fallbackFill: string
}) => {
  const justifyContent =
    overlay.align === 'left' ? 'flex-start' : overlay.align === 'right' ? 'flex-end' : 'center'
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${overlay.x * 100}%`,
          top: `${overlay.y * 100}%`,
          width: `${overlay.width * 100}%`,
          height: `${overlay.height * 100}%`,
          transform: `rotate(${overlay.rotation}deg)`,
          display: 'flex',
          alignItems: overlay.kind === 'lower_third' ? 'flex-end' : 'center',
          justifyContent,
          color: overlay.fill ?? fallbackFill,
          fontFamily,
          fontSize: Math.round(
            42 * (overlay.fontSizeEm ?? (overlay.kind === 'title' ? 1.15 : 0.85)),
          ),
          fontWeight: overlay.kind === 'title' ? 700 : 600,
          lineHeight: 1.15,
          textAlign: overlay.align ?? 'center',
          textShadow: '0 2px 12px rgba(0,0,0,0.55)',
          padding: 8,
          boxSizing: 'border-box',
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  )
}

const CaptionBand = ({
  text,
  captionBg,
  accentColor,
  fontFamily,
  presetId = 'band',
  fromFrame,
  words,
  emphasis = [],
  marks = [],
}: {
  text: string
  captionBg: string
  accentColor: string
  fontFamily: string
  presetId?: 'band' | 'two-line' | 'word-highlight' | 'karaoke'
  fromFrame: number
  words?: { text: string; startMs: number; endMs: number }[]
  emphasis?: number[]
  marks?: { wordIndex: number; src: string }[]
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const highlight = presetId === 'word-highlight' ? tokens.at(-1) : null
  const lead = highlight ? tokens.slice(0, -1).join(' ') : text
  const karaoke = presetId === 'karaoke' && (words?.length ?? 0) > 0
  const nowMs = ((fromFrame + frame) / Math.max(fps, 1)) * 1000
  const active = karaoke ? activeCaptionWordIndex(words ?? [], nowMs) : -1
  const emphasized = new Set(emphasis)
  const markSrc = new Map(marks.map((item) => [item.wordIndex, item.src]))
  const painted = emphasized.size > 0 || markSrc.size > 0
  const timedWords =
    words && words.length > 0
      ? words
      : tokens.map((token) => ({ text: token, startMs: 0, endMs: 0 }))
  const wordRow = karaoke || painted
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        padding: 48,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          background: captionBg,
          color: '#f4f1ea',
          boxShadow: `inset 0 -3px 0 ${accentColor}`,
          fontSize: presetId === 'two-line' ? 36 : 42,
          fontFamily,
          padding: '16px 22px',
          textAlign: 'center',
          maxWidth: presetId === 'two-line' ? '70%' : '92%',
          lineHeight: presetId === 'two-line' ? 1.25 : 1.15,
        }}
      >
        {wordRow ? (
          timedWords.map((word, index) => (
            <span
              key={`${word.startMs}-${word.text}-${index}`}
              style={{
                display: 'inline-block',
                margin: '0 0.18em',
                transform: index === active ? 'scale(1.14)' : 'scale(1)',
                fontWeight: index === active || emphasized.has(index) ? 700 : 500,
                color: index === active || emphasized.has(index) ? accentColor : '#f4f1ea',
              }}
            >
              {word.text}
              {markSrc.get(index) ? (
                <Img
                  src={markSrc.get(index)!}
                  style={{
                    display: 'inline-block',
                    width: 28,
                    height: 28,
                    marginLeft: 4,
                    verticalAlign: 'middle',
                  }}
                />
              ) : null}
            </span>
          ))
        ) : presetId === 'word-highlight' ? (
          <>
            {lead ? `${lead} ` : null}
            <span style={{ color: accentColor, fontWeight: 700 }}>{highlight}</span>
          </>
        ) : (
          text
        )}
      </div>
    </AbsoluteFill>
  )
}

const LogoBug = ({
  src,
  corner = 'top-right',
  scale = 1,
  safeMargin = 40,
}: {
  src: string
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  scale?: number
  safeMargin?: number
}) => {
  const size = Math.round(96 * scale)
  const justifyContent = corner.startsWith('bottom') ? 'flex-end' : 'flex-start'
  const alignItems = corner.endsWith('left') ? 'flex-start' : 'flex-end'
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

const regionStyle = (rect: LayoutRect): React.CSSProperties => ({
  position: 'absolute',
  left: `${rect.x * 100}%`,
  top: `${rect.y * 100}%`,
  width: `${rect.width * 100}%`,
  height: `${rect.height * 100}%`,
})

const MediaLayer = ({
  clip,
  objectFit,
}: {
  clip: TalkingHeadClipProps
  objectFit: 'cover' | 'contain'
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const box = clip.reframe?.tracking.length
    ? interpolateTracking(clip.reframe.tracking, frame / Math.max(fps, 1))
    : null
  const style = box ? panScanStyle(box) : { width: '100%', height: '100%', objectFit }
  const media =
    clip.mediaKind === 'image' ? (
      <Img src={clip.src} style={style} />
    ) : (
      <Video
        src={clip.src}
        trimBefore={clip.trimBefore ?? 0}
        volume={remotionVolume(clip)}
        style={style}
      />
    )
  if (!box) return media
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {media}
    </div>
  )
}

const remotionVolume = (clip: TalkingHeadClipProps): number | ((frame: number) => number) => {
  if (clip.muted) return 0
  if (!clip.volumeEnvelope?.length) return 1
  return (frame: number) => gainAtEnvelope(clip.volumeEnvelope, frame)
}

const clipActiveAt = (clip: TalkingHeadClipProps, globalFrame: number): boolean =>
  globalFrame >= clip.from && globalFrame < clip.from + clip.durationInFrames

const ARollFill = ({
  clip,
  pipClips,
  pipLayout,
}: {
  clip: TalkingHeadClipProps
  pipClips: TalkingHeadClipProps[]
  pipLayout: PipLayout
}) => {
  const frame = useCurrentFrame()
  const pipOn = pipClips.some((row) => clipActiveAt(row, clip.from + frame))
  const layout = normalizePipLayout(pipLayout)
  const rect = pipOn ? layoutRegions(layout).main : { x: 0, y: 0, width: 1, height: 1 }
  const objectFit: 'cover' | 'contain' = pipOn && layout.mode === 'split' ? 'contain' : 'cover'
  return (
    <AbsoluteFill>
      <div
        style={{
          ...regionStyle(rect),
          overflow: 'hidden',
          background: '#0b0f0c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MediaLayer clip={clip} objectFit={objectFit} />
      </div>
    </AbsoluteFill>
  )
}

const PipFill = ({ clip, pipLayout }: { clip: TalkingHeadClipProps; pipLayout: PipLayout }) => {
  const layout = normalizePipLayout(pipLayout)
  const { pip } = layoutRegions(layout)
  const chrome = layout.mode === 'pip'
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          ...regionStyle(pip),
          overflow: 'hidden',
          borderRadius: chrome ? 14 : 0,
          boxShadow: chrome ? '0 12px 40px rgba(0,0,0,0.45)' : undefined,
          border: chrome ? '2px solid rgba(244,241,234,0.35)' : undefined,
          background: '#0b0f0c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MediaLayer clip={clip} objectFit="contain" />
      </div>
    </AbsoluteFill>
  )
}

export const TalkingHead60: React.FC<TalkingHeadProps> = ({
  clips,
  pipClips = [],
  pipLayout = DEFAULT_PIP_LAYOUT,
  stylePackId,
  hookTitle,
  endCard,
  endCardFrom: endCardFromProp,
  endCardDurationInFrames = 90,
  captions = [],
  textOverlays = [],
  stickers = [],
  primaryColor = '#1f6b4a',
  accentColor = '#c45c26',
  captionBg = 'rgba(15,20,16,0.78)',
  fontFamily = 'Georgia, "Times New Roman", serif',
  logoSrc,
  logoCorner = 'top-right',
  logoScale = 1,
  logoSafeMargin = 40,
  brandLabel,
  disclaimer,
  textDirection = 'ltr',
  trialWatermark = false,
}) => {
  const { durationInFrames } = useVideoConfig()
  const endCardFrom = endCardFromProp ?? Math.max(0, durationInFrames - endCardDurationInFrames)
  const endCardFrames = Math.min(
    endCardDurationInFrames,
    Math.max(1, durationInFrames - endCardFrom),
  )
  const chromeLayout = pickPathCChromeLayout(
    `${brandLabel ?? ''}|${primaryColor}|${accentColor}|${fontFamily}`,
  )

  const visualClips = clips.filter((clip) => clip.mediaKind !== 'audio')
  const audioClips = clips.filter((clip) => clip.mediaKind === 'audio')
  const visualPip = pipClips.filter((clip) => clip.mediaKind !== 'audio')
  const audioPip = pipClips.filter((clip) => clip.mediaKind === 'audio')

  const wrapClip = (clip: TalkingHeadClipProps, inner: React.ReactNode) => {
    const pack = getStylePack(clip.filterId ?? stylePackId)
    const intensity = clip.filterId ? (clip.filterIntensity ?? 1) : 1
    const treated = <TreatmentProvider treatments={clip.treatments}>{inner}</TreatmentProvider>
    if (clip.cubeLut) {
      return (
        <CubeLutProvider lut={clip.cubeLut} intensity={intensity}>
          {treated}
        </CubeLutProvider>
      )
    }
    return (
      <StylePackProvider pack={pack} intensity={intensity}>
        {treated}
      </StylePackProvider>
    )
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f0c', direction: textDirection }}>
      {visualClips.length === 0 ? (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            color: '#9aa89a',
            fontSize: 42,
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            padding: 48,
          }}
        >
          {audioClips.length > 0
            ? 'Audio-only preview — drop footage for picture'
            : 'Drop footage to preview'}
        </AbsoluteFill>
      ) : (
        visualClips.map((clip) => (
          <Sequence
            key={`${clip.src}-${clip.from}-${clip.mediaKind ?? 'video'}`}
            from={clip.from}
            durationInFrames={clip.durationInFrames}
          >
            {wrapClip(clip, <ARollFill clip={clip} pipClips={visualPip} pipLayout={pipLayout} />)}
          </Sequence>
        ))
      )}

      {visualPip.map((clip) => (
        <Sequence
          key={`pip-${clip.src}-${clip.from}`}
          from={clip.from}
          durationInFrames={clip.durationInFrames}
        >
          {wrapClip(clip, <PipFill clip={clip} pipLayout={pipLayout} />)}
        </Sequence>
      ))}

      {audioClips.map((clip) => (
        <Sequence
          key={`audio-${clip.src}-${clip.from}`}
          from={clip.from}
          durationInFrames={clip.durationInFrames}
        >
          <Audio src={clip.src} trimBefore={clip.trimBefore ?? 0} volume={remotionVolume(clip)} />
        </Sequence>
      ))}
      {audioPip.map((clip) => (
        <Sequence
          key={`pip-audio-${clip.src}-${clip.from}`}
          from={clip.from}
          durationInFrames={clip.durationInFrames}
        >
          <Audio src={clip.src} trimBefore={clip.trimBefore ?? 0} volume={remotionVolume(clip)} />
        </Sequence>
      ))}

      {hookTitle ? (
        <Sequence from={0} durationInFrames={90}>
          <PathCHookTitle
            text={hookTitle}
            primaryColor={primaryColor}
            accentColor={accentColor}
            fontFamily={fontFamily}
            layout={chromeLayout}
            brandLabel={brandLabel}
          />
        </Sequence>
      ) : null}

      {textOverlays.map((overlay) => (
        <Sequence key={overlay.id} from={overlay.from} durationInFrames={overlay.durationInFrames}>
          <TextOverlayLayer overlay={overlay} fontFamily={fontFamily} fallbackFill={primaryColor} />
        </Sequence>
      ))}

      {stickers.map((sticker) => (
        <Sequence key={sticker.id} from={sticker.from} durationInFrames={sticker.durationInFrames}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <Img
              src={sticker.src}
              style={{
                position: 'absolute',
                left: `${sticker.x * 100}%`,
                top: `${sticker.y * 100}%`,
                width: `${sticker.width * 100}%`,
                height: `${sticker.height * 100}%`,
                transform: `rotate(${sticker.rotation}deg)`,
                objectFit: 'contain',
              }}
            />
          </AbsoluteFill>
        </Sequence>
      ))}

      {captions.map((caption, index) => (
        <Sequence
          key={`caption-${index}-${caption.from}`}
          from={caption.from}
          durationInFrames={caption.durationInFrames}
        >
          <CaptionBand
            text={caption.text}
            captionBg={captionBg}
            accentColor={accentColor}
            fontFamily={fontFamily}
            presetId={caption.presetId}
            fromFrame={caption.from}
            words={caption.words}
            emphasis={caption.emphasis}
            marks={caption.marks}
          />
        </Sequence>
      ))}

      {logoSrc && !endCard ? (
        <Sequence from={0} durationInFrames={durationInFrames}>
          <LogoBug
            src={logoSrc}
            corner={logoCorner}
            scale={logoScale}
            safeMargin={logoSafeMargin}
          />
        </Sequence>
      ) : null}

      {logoSrc && endCard ? (
        <Sequence from={0} durationInFrames={endCardFrom}>
          <LogoBug src={logoSrc} />
        </Sequence>
      ) : null}

      {endCard ? (
        <Sequence from={endCardFrom} durationInFrames={endCardFrames}>
          <PathCEndCard
            text={endCard}
            primaryColor={primaryColor}
            accentColor={accentColor}
            fontFamily={fontFamily}
            layout={chromeLayout}
            brandLabel={brandLabel}
            logoSrc={logoSrc}
          />
        </Sequence>
      ) : null}

      {disclaimer ? (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 40px 18px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              color: 'rgba(244,241,234,0.72)',
              fontSize: 18,
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'center',
              maxWidth: '92%',
              lineHeight: 1.35,
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
