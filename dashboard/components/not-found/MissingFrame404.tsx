'use client'

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PRODUCT_NAME } from '../../lib/product-name'

/** Shell 404 — “missing frame on the timeline” (not stock Next). */
export const missingFrame404Meta = {
  id: 'mos-missing-frame-404',
  fps: 30,
  width: 960,
  height: 540,
  durationInFrames: 120,
} as const

const TRACK_Y = 340
const GAP_X = 420
const GAP_W = 120

export const MissingFrame404 = () => {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  })
  const titleOpacity = interpolate(enter, [0, 1], [0, 1])
  const titleY = interpolate(enter, [0, 1], [18, 0])

  const playheadX = interpolate(frame, [0, 90], [80, width - 80], {
    extrapolateRight: 'clamp',
  })
  const inGap = playheadX >= GAP_X && playheadX <= GAP_X + GAP_W
  const gapPulse = inGap
    ? interpolate(Math.sin((frame / fps) * Math.PI * 3), [-1, 1], [0.35, 0.85])
    : 0.25

  const numberScale = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 14, stiffness: 90 },
  })

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(120% 90% at 50% 0%, #1b2433 0%, #0c0e11 55%, #0a0b0e 100%)',
        color: '#e9edf2',
        fontFamily: 'IBM Plex Sans, Segoe UI, system-ui, sans-serif',
      }}
    >
      <AbsoluteFill
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          padding: '64px 72px 0',
        }}
      >
        <div
          style={{
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#a8b0bd',
            marginBottom: 12,
          }}
        >
          {PRODUCT_NAME}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 20,
          }}
        >
          <span
            style={{
              fontFamily: 'Syne, system-ui, sans-serif',
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1,
              transform: `scale(${0.92 + numberScale * 0.08})`,
              color: '#6ba0ff',
            }}
          >
            404
          </span>
          <span
            style={{
              fontFamily: 'Syne, system-ui, sans-serif',
              fontSize: 34,
              fontWeight: 600,
              maxWidth: 420,
              lineHeight: 1.2,
            }}
          >
            This cut isn't on the timeline
          </span>
        </div>
        <p
          style={{
            marginTop: 18,
            maxWidth: 480,
            fontSize: 17,
            lineHeight: 1.45,
            color: '#c4cad4',
          }}
        >
          The route you asked for isn’t mounted. Jump back to a known surface — Campaigns, Studio,
          or Dashboard.
        </p>
      </AbsoluteFill>

      {/* Timeline metaphor */}
      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          top: TRACK_Y,
          height: 56,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 22,
            height: 12,
            borderRadius: 6,
            background: '#1b1f26',
            border: '1px solid #252b34',
          }}
        />
        {/* Clips */}
        <div
          style={{
            position: 'absolute',
            left: 24,
            width: GAP_X - 48,
            top: 14,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(90deg, #2a3344, #243049)',
            border: '1px solid #3a465c',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: GAP_X,
            width: GAP_W,
            top: 14,
            height: 28,
            borderRadius: 8,
            background: `rgba(229, 100, 108, ${gapPulse})`,
            border: '1px dashed #e5646c',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: '#e9edf2',
          }}
        >
          MISSING
        </div>
        <div
          style={{
            position: 'absolute',
            left: GAP_X + GAP_W + 16,
            right: 24,
            top: 14,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(90deg, #243049, #2a3344)',
            border: '1px solid #3a465c',
          }}
        />
        {/* Playhead */}
        <div
          style={{
            position: 'absolute',
            left: playheadX - 64,
            top: 0,
            width: 2,
            height: 56,
            background: '#4c8dff',
            boxShadow: '0 0 12px rgba(76, 141, 255, 0.45)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: playheadX - 64 - 5,
            top: -2,
            width: 12,
            height: 12,
            borderRadius: 2,
            background: '#4c8dff',
            transform: 'rotate(45deg)',
          }}
        />
      </div>
    </AbsoluteFill>
  )
}
