import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPackArchivePaths } from '@synawood/creative/packs/safety'
import {
  ARTEFACTS_NO_PLAN,
  artefactsPlanLine,
  artefactsUploadForbidden,
  sanitiseSkillMarkdown,
} from './artefacts-bin'

describe('Artefacts media bin (#1071)', () => {
  it('labels missing and known Generation Plan statuses', () => {
    expect(artefactsPlanLine(null)).toBe(ARTEFACTS_NO_PLAN)
    expect(artefactsPlanLine(undefined)).toBe(ARTEFACTS_NO_PLAN)
    expect(artefactsPlanLine('draft')).toBe('Plan: draft')
    expect(artefactsPlanLine('ready')).toBe('Plan: ready')
    expect(artefactsPlanLine('applied')).toBe('Plan: applied')
    expect(artefactsPlanLine('stale')).toBe('Plan: stale')
  })

  it('exposes an Artefacts tab next to Story with no New file control', () => {
    const bin = readFileSync(join(process.cwd(), 'components/studio/AssetBin.tsx'), 'utf8')
    const artefacts = readFileSync(
      join(process.cwd(), 'components/studio/ArtefactsBin.tsx'),
      'utf8',
    )
    expect(bin).toMatch(/Artefacts/)
    expect(bin).toMatch(/mediaMode === 'artefacts'/)
    expect(bin).toMatch(/id="asset-bin-mode-story"/)
    expect(bin).toMatch(/id="asset-bin-mode-artefacts"/)
    expect(artefacts).not.toMatch(/New file/i)
    expect(artefacts).toContain('/api/studio/skills')
    expect(artefacts).toContain('onOpenPlan')
  })
})

describe('Artefacts skill markdown (#1072)', () => {
  it('reuses the pack executable denylist and also refuses .js', () => {
    expect(
      checkPackArchivePaths([{ path: 'bin/run.sh', size: 10 }]).some(
        (issue) => issue.code === 'executable',
      ),
    ).toBe(true)
    expect(artefactsUploadForbidden('bin/run.sh')).toBe(true)
    expect(artefactsUploadForbidden('hook.js')).toBe(true)
    expect(artefactsUploadForbidden('scripts/install.sh')).toBe(true)
    expect(artefactsUploadForbidden('SKILL.md')).toBe(false)
    expect(
      checkPackArchivePaths([{ path: 'hook.js', size: 1 }]).some(
        (issue) => issue.code === 'executable',
      ),
    ).toBe(false)
  })

  it('strips HTML tags and javascript: from skill markdown', () => {
    expect(
      sanitiseSkillMarkdown('# Title\n<script>alert(1)</script>\n[x](javascript:alert(1))'),
    ).toBe('# Title\nalert(1)\n[x](alert(1))')
  })

  it('opens sanitised read-only markdown on skill click with no upload or HTML inject', () => {
    const artefacts = readFileSync(
      join(process.cwd(), 'components/studio/ArtefactsBin.tsx'),
      'utf8',
    )
    expect(artefacts).toContain('PackMarkdownPreview')
    expect(artefacts).toContain('sanitiseSkillMarkdown')
    expect(artefacts).toContain('selectedSkill')
    expect(artefacts).not.toMatch(/type=["']file["']/)
    expect(artefacts).not.toMatch(/dangerouslySetInnerHTML/)
    expect(artefacts).not.toMatch(/Enable/)
    expect(artefacts).not.toMatch(/Disable/)
  })
})
