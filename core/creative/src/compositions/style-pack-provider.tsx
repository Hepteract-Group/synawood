import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { StylePack } from '../effects/packs'

type StylePackProviderProps = {
  pack: StylePack | null
  intensity?: number
  children: React.ReactNode
}

const mix = (identity: number, value: number, intensity: number): number =>
  identity + (value - identity) * intensity

/** Grade + vignette under Path C chrome. Pack must not hide logo/captions. */
export const StylePackProvider = ({ pack, intensity = 1, children }: StylePackProviderProps) => {
  if (!pack) return <>{children}</>
  const amount = Math.min(1, Math.max(0, intensity))
  const filter = [
    `contrast(${mix(1, pack.contrast, amount)})`,
    `saturate(${mix(1, pack.saturate, amount)})`,
    `hue-rotate(${mix(0, pack.hueRotate, amount)}deg)`,
    `sepia(${mix(0, pack.sepia, amount)})`,
  ].join(' ')
  const vignette = mix(0, pack.vignette, amount)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter }}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(circle at center, transparent 42%, rgba(0,0,0,${vignette}) 100%)`,
          opacity: vignette > 0 ? 1 : 0,
        }}
      />
    </AbsoluteFill>
  )
}
