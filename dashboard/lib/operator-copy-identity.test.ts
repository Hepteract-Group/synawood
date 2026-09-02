import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const walkTsx = (dir: string): string[] => {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      out.push(...walkTsx(path))
      continue
    }
    if (!name.endsWith('.tsx')) continue
    if (name.includes('.test.')) continue
    out.push(path)
  }
  return out
}

describe('operator chrome copy (#900)', () => {
  it('does not name the private example in app or component UI', () => {
    const hits: string[] = []
    for (const root of [join(process.cwd(), 'app'), join(process.cwd(), 'components')]) {
      for (const file of walkTsx(root)) {
        const text = readFileSync(file, 'utf8')
        if (/the private example|demoreader|demo\.myshopify/i.test(text)) hits.push(file)
      }
    }
    expect(hits).toEqual([])
  })
})

describe('operator chrome copy (#1137)', () => {
  it('does not show GTM Phase labels in operator UI', () => {
    const hits: string[] = []
    for (const root of [join(process.cwd(), 'app'), join(process.cwd(), 'components')]) {
      for (const file of walkTsx(root)) {
        const text = readFileSync(file, 'utf8')
        if (/Phase\s*[0-3]|PHASE\s*[0-3]/.test(text)) hits.push(file)
      }
    }
    expect(hits).toEqual([])
  })
})
