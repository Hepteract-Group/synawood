import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

export const PUBLIC_DENYLIST = [
  'products/demo',
  '.github/workflows/post-merge.yml',
  'thought_dumps',
  'docs/local',
  'cloud',
  '.cursor',
  'AGENTS.md',
  'core/runbooks/postiz-hosting.md',
  'core/runbooks/weekly-founder-content-batch.md',
  // Hosted catalog / take-a-card contract — not Apache core (#995 / ADR-0079)
  'docs/adr/0082-hosted-billing-wallet-entitlements.md',
  'docs/adr/0083-trial-path-to-first-approve.md',
  'docs/system-design/billing.md',
  'docs/architecture/billing.md',
  'docs/ux/billing.md',
  'docs/ui/billing.md',
  'docs/oss',
  'docs/adr/0094-hosted-studio-workers-on-fly.md',
  'docs/architecture/studio-workers.md',
  'docs/architecture/vercel-deploy.md',
] as const

const SKIP_COPY = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '.turbo', 'local'])

const STRIP_RULES: { re: RegExp; to: string }[] = [
  { re: /demoreader\.com/gi, to: 'example.com' },
  { re: /the former reader/gi, to: 'the former reader' },
  { re: /REDACTED_PROJECT_REF/g, to: 'REDACTED_PROJECT_REF' },
  { re: /hosted-vercel-team/g, to: 'hosted-vercel-team' },
  { re: /postgres(?:ql)?:\/\/\S+/gi, to: '[redacted-db-url]' },
  { re: /the private example/g, to: 'the private example' },
  { re: /demo/gi, to: 'demo' },
  { re: /Synawood/gi, to: 'Synawood' },
  { re: /\bMOS\b/g, to: 'Synawood' },
  { re: /@mos\//g, to: '@synawood/' },
]

const LEAK_PATTERNS: RegExp[] = [
  /demo|the former reader|demoreader\.com|REDACTED_PROJECT_REF|hosted-vercel-team|postgres(?:ql)?:\/\/|Synawood/i,
  /\bMOS\b/,
  /@mos\//,
]

const hasLeak = (text: string) => LEAK_PATTERNS.some((re) => re.test(text))

export type PublicTreeLeak = { path: string; excerpt: string }

export type PublicTreeResult = {
  dest: string
  removed: string[]
  leaks: PublicTreeLeak[]
}

const isSkippedDir = (name: string) => SKIP_COPY.has(name)

const posix = (rel: string) => rel.split(sep).join('/')

/** Gitignored env files must never enter a snapshot (#906). */
const isSecretEnvFile = (rel: string): boolean => {
  const base = rel.split('/').pop() ?? ''
  if (base.endsWith('.example')) return false
  return base === '.env' || base.startsWith('.env.')
}

const underDenylist = (rel: string): string | undefined => {
  const path = posix(rel)
  return PUBLIC_DENYLIST.find((item) => path === item || path.startsWith(`${item}/`))
}

const walkFiles = (root: string, acc: string[] = []): string[] => {
  for (const name of readdirSync(root)) {
    if (isSkippedDir(name)) continue
    const full = join(root, name)
    const st = statSync(full)
    if (st.isDirectory()) walkFiles(full, acc)
    else acc.push(full)
  }
  return acc
}

const stripText = (text: string): string => {
  let next = text
  for (const rule of STRIP_RULES) next = next.replace(rule.re, rule.to)
  return next
}

const isProbablyText = (file: string) => {
  const base = file.split(/[/\\]/).pop() ?? ''
  if (base.endsWith('.example')) return true
  return /\.(md|mdx|txt|ts|tsx|js|mjs|cjs|json|yml|yaml|css|html|sql|toml|svg)$/i.test(file)
}

/** Public rewrites live in private `docs/oss/`. Overlay onto dest `docs/` (#1381). */
const overlayOssDocs = (srcRoot: string, dest: string) => {
  const oss = join(srcRoot, 'docs/oss')
  if (!existsSync(oss)) return
  for (const file of walkFiles(oss)) {
    const rel = posix(relative(oss, file))
    const target = rel === 'AGENTS.md' ? join(dest, 'AGENTS.md') : join(dest, 'docs', rel)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(file, target)
  }
}

export const buildPublicTree = (input: {
  src: string
  dest: string
  strip?: boolean
}): PublicTreeResult => {
  const strip = input.strip !== false
  rmSync(input.dest, { recursive: true, force: true })
  mkdirSync(input.dest, { recursive: true })
  cpSync(input.src, input.dest, {
    recursive: true,
    filter: (path) => {
      const rel = posix(relative(input.src, path))
      if (!rel || rel === '.') return true
      if (isSecretEnvFile(rel)) return false
      return !rel.split('/').some((part) => isSkippedDir(part))
    },
  })

  const removed: string[] = []
  for (const item of PUBLIC_DENYLIST) {
    const target = join(input.dest, item)
    if (!existsSync(target)) continue
    rmSync(target, { recursive: true, force: true })
    removed.push(item)
  }

  overlayOssDocs(input.src, input.dest)

  const leaks: PublicTreeLeak[] = []
  for (const file of walkFiles(input.dest)) {
    const rel = posix(relative(input.dest, file))
    if (underDenylist(rel)) continue
    if (!isProbablyText(file)) continue
    let text = readFileSync(file, 'utf8')
    if (strip) {
      const stripped = stripText(text)
      if (stripped !== text) writeFileSync(file, stripped)
      text = stripped
    }
    if (hasLeak(text)) {
      const line = text.split(/\r?\n/).find((row) => hasLeak(row)) ?? text.slice(0, 120)
      leaks.push({ path: rel, excerpt: line.trim().slice(0, 200) })
    }
  }

  return { dest: input.dest, removed, leaks }
}

export const formatLeaks = (leaks: PublicTreeLeak[]): string =>
  leaks.map((leak) => `${leak.path}: ${leak.excerpt}`).join('\n')
