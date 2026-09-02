import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(process.cwd(), '..')

const walk = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, acc)
      continue
    }
    if (/\.(ts|tsx|js|mjs)$/.test(entry)) acc.push(full)
  }
  return acc
}

const PRODUCT_ID_LITERAL = /productId:\s*['"]demo['"]|product_id:\s*['"]demo['"]/

describe('default test product id (#903)', () => {
  it('does not use demo as the stand-in product id in core or dashboard', () => {
    const hits: string[] = []
    for (const root of ['core', 'dashboard']) {
      for (const file of walk(join(repo, root))) {
        const text = readFileSync(file, 'utf8')
        if (!PRODUCT_ID_LITERAL.test(text)) continue
        hits.push(relative(repo, file))
      }
    }
    expect(hits).toEqual([])
  })
})
