import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPublicTree, formatLeaks } from '../dashboard/lib/oss-public-tree.ts'

const check = process.argv.includes('--check')
const outFlag = process.argv.indexOf('--out')
const srcFlag = process.argv.indexOf('--src')
const dest =
  outFlag >= 0 && process.argv[outFlag + 1]
    ? process.argv[outFlag + 1]
    : join(mkdtempSync(join(tmpdir(), 'oss-public-')), 'tree')

const src =
  srcFlag >= 0 && process.argv[srcFlag + 1]
    ? process.argv[srcFlag + 1]
    : join(import.meta.dirname, '..')
const result = buildPublicTree({ src, dest })

if (result.removed.length > 0) {
  console.log(`removed denylist:\n${result.removed.map((item) => `  ${item}`).join('\n')}`)
}

if (result.leaks.length > 0) {
  console.error(`public-tree leaks:\n${formatLeaks(result.leaks)}`)
  process.exit(1)
}

console.log(`public tree ok at ${result.dest}`)
if (check && outFlag < 0) rmSync(join(dest, '..'), { recursive: true, force: true })
