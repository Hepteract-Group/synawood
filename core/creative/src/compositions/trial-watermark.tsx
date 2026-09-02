import React from 'react'
import { AbsoluteFill } from 'remotion'

/** Path C trial mark — visible on preview and export when plan.watermarkExports (#1044). */
export const TrialWatermark = ({ fontFamily }: { fontFamily?: string }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: '0 48px 56px',
      zIndex: 40,
    }}
  >
    <div
      style={{
        color: 'rgba(244, 241, 234, 0.35)',
        fontFamily: fontFamily ?? 'Georgia, "Times New Roman", serif',
        fontSize: 42,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        textShadow: '0 1px 8px rgba(0,0,0,0.35)',
      }}
    >
      Trial
    </div>
  </AbsoluteFill>
)
