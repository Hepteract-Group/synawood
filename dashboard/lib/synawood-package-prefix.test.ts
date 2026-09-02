import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(process.cwd(), '..')
const skipDir = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '.turbo', '.cursor'])

const filesContaining = (needle: string): string[] => {
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skipDir.has(name)) continue
      if (name === 'package-lock.json') continue
      const path = join(dir, name)
      const stat = statSync(path)
      if (stat.isDirectory()) {
        walk(path)
        continue
      }
      try {
        const text = readFileSync(path, 'utf8')
        if (text.includes(needle)) hits.push(path.slice(repo.length + 1))
      } catch {
        // binary
      }
    }
  }
  walk(repo)
  return hits
}

describe('Synawood package and env identifiers (#1334)', () => {
  it('has no legacy scoped package imports', () => {
    expect(filesContaining(['@', 'mos/'].join(''))).toEqual([])
  })

  it('has no legacy Synawood env identifiers except the private git slug', () => {
    const leftover = filesContaining(['Synawood', '_'].join('')).filter(
      (path) => path !== 'README.md' && !path.includes('marketing-os'),
    )
    const still = leftover.filter((path) => {
      const text = readFileSync(join(repo, path), 'utf8')
      return text
        .split('\n')
        .some(
          (line) =>
            line.includes(['Synawood', '_'].join('')) && !line.includes('Hepteract-Group/marketing-os'),
        )
    })
    expect(still).toEqual([])
  })
})
