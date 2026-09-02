import React from 'react'
import { AbsoluteFill } from 'remotion'
import { cubeLutToCssFilter, type CubeLut } from '../library/cube'

type CubeLutProviderProps = {
  lut: CubeLut | null
  intensity?: number
  children: React.ReactNode
}

/** 3D LUT applied as SVG component-transfer curves sampled from the cube (#720). */
export const CubeLutProvider = ({ lut, intensity = 1, children }: CubeLutProviderProps) => {
  if (!lut) return <>{children}</>
  const filter = cubeLutToCssFilter(lut, intensity)
  if (filter === 'none') return <>{children}</>
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  )
}
