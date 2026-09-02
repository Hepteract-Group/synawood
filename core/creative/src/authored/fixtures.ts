export const LEGAL_AUTHORED_FIXTURE = `import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export default function KineticHook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = spring({ frame, fps, config: { damping: 14, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d0c', justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          color: '#f4f1ea',
          fontSize: 64,
          fontWeight: 700,
          opacity,
          transform: 'translateY(' + ((1 - y) * 36) + 'px)',
        }}
      >
        Still juggling PDFs?
      </div>
    </AbsoluteFill>
  )
}
`

export const LEGAL_KIT_FIXTURE = `import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { KineticType } from '@synawood/creative/motion-kit'

export default function KitHook() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d0c', justifyContent: 'center' }}>
      <KineticType dialect="editorial" text={'Frame ' + frame} />
    </AbsoluteFill>
  )
}
`
