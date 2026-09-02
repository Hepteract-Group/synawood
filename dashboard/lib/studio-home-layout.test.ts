import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Studio home layout (#827)', () => {
  it('drops square project cards on phone after the base card rules', () => {
    expect(css).toMatch(
      /\/\* #827 Studio home[\s\S]{0,500}?@media \(max-width: 640px\) \{[\s\S]{0,160}?\.studio-project-card \{[\s\S]{0,80}?aspect-ratio: auto/,
    )
  })
})
