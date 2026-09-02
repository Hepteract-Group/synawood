#!/usr/bin/env node
/**
 * #906 — first public snapshot, and the #907 mirror job later.
 * Always `git archive`s HEAD so gitignored env files never enter dest.
 * `--push` is private-SoT ops only. Refuses if the public remote already has main.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPublicTree, formatLeaks } from '../dashboard/lib/oss-public-tree.ts'

const DEFAULT_REMOTE = 'https://github.com/Hepteract-Group/synawood.git'
const repoRoot = join(import.meta.dirname, '..')

const flagValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined
}

const push = process.argv.includes('--push')
const remote = flagValue('--remote') ?? DEFAULT_REMOTE
const dest = flagValue('--out') ?? join(mkdtempSync(join(tmpdir(), 'oss-snap-')), 'tree')
const src = mkdtempSync(join(tmpdir(), 'oss-src-'))

const runGit = (
  args: string[],
  cwd: string,
  options?: { input?: Buffer; allowFail?: boolean },
) => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'buffer',
    maxBuffer: 512 * 1024 * 1024,
    input: options?.input,
  })
  if ((result.status ?? 1) !== 0 && !options?.allowFail) {
    const err = result.stderr.toString() || result.stdout.toString()
    console.error(`git ${args.join(' ')} failed:\n${err}`)
    process.exit(result.status ?? 1)
  }
  return result
}

const extractGitHead = (repo: string, into: string) => {
  mkdirSync(into, { recursive: true })
  const archive = runGit(['archive', 'HEAD'], repo)
  const tar = spawnSync('tar', ['-x', '-C', into], {
    input: archive.stdout,
    maxBuffer: 512 * 1024 * 1024,
  })
  if ((tar.status ?? 1) !== 0) {
    console.error(`tar extract failed:\n${tar.stderr.toString()}`)
    process.exit(tar.status ?? 1)
  }
}

const requirePublicTree = (tree: string) => {
  const missing = ['LICENSE', 'NOTICE', 'AGENTS.md'].filter((p) => !existsSync(join(tree, p)))
  if (missing.length > 0) {
    console.error(`snapshot missing: ${missing.join(', ')}`)
    process.exit(1)
  }
  const forbidden = [
    'products/demo',
    '.github/workflows/post-merge.yml',
    'docs/local',
    'docs/oss',
  ]
  const leaked = forbidden.filter((p) => existsSync(join(tree, p)))
  if (leaked.length > 0) {
    console.error(`snapshot still has denylist paths: ${leaked.join(', ')}`)
    process.exit(1)
  }
}

const lastPrivateIdentity = () => {
  const name = spawnSync('git', ['log', '-1', '--format=%an'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  const email = spawnSync('git', ['log', '-1', '--format=%ae'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  return {
    name: name.stdout.trim() || 'Synawood snapshot',
    email: email.stdout.trim() || 'snapshot@synawood.invalid',
  }
}

const publicRemoteHasMain = (): boolean => {
  const ls = spawnSync('git', ['ls-remote', '--heads', remote, 'main'], {
    encoding: 'utf8',
  })
  if ((ls.status ?? 1) !== 0) {
    console.error(`git ls-remote failed:\n${ls.stderr}`)
    process.exit(ls.status ?? 1)
  }
  return ls.stdout.trim().length > 0
}

const orphanCommitAndPush = (tree: string) => {
  if (publicRemoteHasMain()) {
    console.error(
      `${remote} already has main. Refusing to force-push. #906 is first snapshot only.`,
    )
    process.exit(1)
  }
  const ident = lastPrivateIdentity()
  runGit(['init', '-b', 'main'], tree)
  runGit(['add', '-A'], tree)
  runGit(
    [
      '-c',
      `user.name=${ident.name}`,
      '-c',
      `user.email=${ident.email}`,
      'commit',
      '-m',
      'Synawood Apache-2.0 core',
    ],
    tree,
  )
  runGit(['remote', 'add', 'origin', remote], tree)
  runGit(['push', '-u', 'origin', 'main'], tree)
}

try {
  extractGitHead(repoRoot, src)
  const result = buildPublicTree({ src, dest })
  if (result.leaks.length > 0) {
    console.error(`public-tree leaks:\n${formatLeaks(result.leaks)}`)
    process.exit(1)
  }
  requirePublicTree(dest)
  console.log(`public snapshot ok at ${dest}`)
  if (push) orphanCommitAndPush(dest)
} finally {
  rmSync(src, { recursive: true, force: true })
}
