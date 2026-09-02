import { describe, expect, it } from 'vitest'
import { compileAuthoredComposition } from './compile'
import { injectMissingMotionKitImports } from './inject-kit-imports'

describe('injectMissingMotionKitImports', () => {
  it('adds CountUp from the motion kit when the agent forgot the import', () => {
    const source = `import { AbsoluteFill } from 'remotion'
export default () => <AbsoluteFill><CountUp value={3} /></AbsoluteFill>
`
    const injected = injectMissingMotionKitImports(source)
    expect(injected).toMatch(/import \{ CountUp \} from '@synawood\/creative\/motion-kit'/)
    const result = compileAuthoredComposition(source)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toMatch(/@synawood\/creative\/motion-kit/)
    expect(result.code).toMatch(/CountUp/)
  })

  it('does not duplicate an existing kit import', () => {
    const source = `import { CountUp } from '@synawood/creative/motion-kit'
export default () => <CountUp value={3} />
`
    expect(injectMissingMotionKitImports(source)).toBe(source)
  })
})
