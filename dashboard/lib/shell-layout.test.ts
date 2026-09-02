import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('operator shell layout (#1137)', () => {
  it('does not force the skip link into a zero-height grid cell', () => {
    expect(css).not.toMatch(/\.shell-layout > \.skip-link/)
  })

  it('parks the skip link off-screen until focus', () => {
    expect(css).toMatch(
      /\.skip-link \{[\s\S]{0,280}?transform: translateY\(calc\(-100% - 1\.5rem\)\)/,
    )
    expect(css).toMatch(/\.skip-link:focus \{[\s\S]{0,120}?transform: translateY\(0\)/)
  })
})
