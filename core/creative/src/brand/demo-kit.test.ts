import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const demoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
  'products/demo',
)

const walkFiles = (dir: string): string[] => {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const next = path.join(dir, name)
    if (statSync(next).isDirectory()) {
      out.push(...walkFiles(next))
      continue
    }
    out.push(next)
  }
  return out
}

describe('demo Product stub (#902)', () => {
  it('does not ship the private example or Hepteract copy in products/demo', () => {
    const hits: string[] = []
    for (const file of walkFiles(demoRoot)) {
      if (file.endsWith('.svg')) continue
      const text = readFileSync(file, 'utf8')
      if (/the private example|Hepteract|demoreader|demo\.myshopify/i.test(text))
        hits.push(path.relative(demoRoot, file))
    }
    expect(hits).toEqual([])
  })
})
