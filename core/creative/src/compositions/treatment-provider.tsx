import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { ClipTreatment } from '../project/schema'
import { styleForTreatments } from './treatment-style'

type TreatmentProviderProps = {
  treatments?: readonly ClipTreatment[]
  children: React.ReactNode
}

/** Motion treatments on clip picture only — never wrap Path C logo or captions. */
export const TreatmentProvider = ({ treatments, children }: TreatmentProviderProps) => {
  const frame = useCurrentFrame()
  if (!treatments?.length) return <>{children}</>
  const style = styleForTreatments(treatments, frame)
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: style.transform === 'none' ? undefined : style.transform,
          filter: style.filter || undefined,
        }}
      >
        {children}
      </AbsoluteFill>
      {style.glowOpacity > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 50% 40%, rgba(255,255,240,0.55), transparent 58%)',
            opacity: style.glowOpacity,
          }}
        />
      ) : null}
      {style.flashOpacity > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: '#fff',
            opacity: style.flashOpacity,
          }}
        />
      ) : null}
    </AbsoluteFill>
  )
}
