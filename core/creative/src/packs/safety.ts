/** Static safety checks before pack install (ADR-0039 / #287). */

import { isPackExecutablePath } from './executable-path'
import { packManifestSchema, type PackManifest } from './schema'

const FORBIDDEN_SPEND_TOOLS = new Set([
  'generate_image',
  'generate_video_clip',
  'generate_voiceover',
  'generate_music',
  'generate_campaign_creatives',
  'animate_campaign_creative',
  'translate_all_missing',
  'dub_project_for_locale',
  'synthesize_voice',
  'translate_and_dub',
])

export type PackArchiveEntry = {
  path: string
  /** bytes length; executables often flagged by extension */
  size: number
  isDirectory?: boolean
}

export type PackSafetyIssue = {
  code:
    | 'path_traversal'
    | 'absolute_path'
    | 'executable'
    | 'missing_manifest'
    | 'invalid_manifest'
    | 'entry_missing'
    | 'spend_without_confirm'
  message: string
}

export const checkPackArchivePaths = (entries: PackArchiveEntry[]): PackSafetyIssue[] => {
  const issues: PackSafetyIssue[] = []
  for (const entry of entries) {
    const normalized = entry.path.replace(/\\/g, '/')
    if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) {
      issues.push({
        code: 'absolute_path',
        message: `Absolute path not allowed: ${entry.path}`,
      })
    }
    if (normalized.split('/').includes('..')) {
      issues.push({
        code: 'path_traversal',
        message: `Path traversal not allowed: ${entry.path}`,
      })
    }
    if (!entry.isDirectory && isPackExecutablePath(normalized)) {
      issues.push({
        code: 'executable',
        message: `Executable / native binary not allowed: ${entry.path}`,
      })
    }
    if (normalized === 'node_modules' || normalized.startsWith('node_modules/')) {
      issues.push({
        code: 'executable',
        message: `node_modules not allowed in packs: ${entry.path}`,
      })
    }
  }
  return issues
}

export const checkPackManifest = (input: {
  manifestRaw: unknown
  entryPaths: string[]
}): { ok: boolean; manifest?: PackManifest; issues: PackSafetyIssue[] } => {
  const issues: PackSafetyIssue[] = []
  if (input.manifestRaw == null) {
    return {
      ok: false,
      issues: [{ code: 'missing_manifest', message: 'pack.json / manifest missing' }],
    }
  }
  const parsed = packManifestSchema.safeParse(input.manifestRaw)
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid_manifest',
          message: parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid manifest',
        },
      ],
    }
  }
  const manifest = parsed.data
  const entrySet = new Set(input.entryPaths.map((p) => p.replace(/\\/g, '/')))
  for (const entry of manifest.entries) {
    const normalized = entry.replace(/\\/g, '/')
    if (!entrySet.has(normalized)) {
      issues.push({
        code: 'entry_missing',
        message: `Manifest entry missing from archive: ${entry}`,
      })
    }
  }
  const hinted = manifest.hintedTools ?? []
  const spendHints = hinted.filter((tool) => FORBIDDEN_SPEND_TOOLS.has(tool))
  if (spendHints.length > 0 && manifest.requiresConfirmSpend !== true) {
    issues.push({
      code: 'spend_without_confirm',
      message: `Spend-capable tools (${spendHints.join(', ')}) require requiresConfirmSpend=true`,
    })
  }
  return { ok: issues.length === 0, manifest, issues }
}

export const assertPackSafe = (input: {
  entries: PackArchiveEntry[]
  manifestRaw: unknown
}): PackManifest => {
  const pathIssues = checkPackArchivePaths(input.entries)
  const manifestCheck = checkPackManifest({
    manifestRaw: input.manifestRaw,
    entryPaths: input.entries.filter((e) => !e.isDirectory).map((e) => e.path),
  })
  const issues = [...pathIssues, ...manifestCheck.issues]
  if (issues.length > 0 || !manifestCheck.manifest) {
    throw new Error(issues.map((i) => i.message).join('; ') || 'Pack failed safety checks')
  }
  return manifestCheck.manifest
}
