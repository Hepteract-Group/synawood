import { describe, expect, it, vi } from 'vitest'
import {
  parseSkillsShSource,
  wrapSkillMarkdownAsPack,
  assertHostedSkillPathAllowed,
  fetchSkillMarkdown,
  skillMarkdownCandidatePaths,
} from './from-skills-sh'

describe('skills.sh import (#956)', () => {
  it('parses owner/repo and skills.sh URLs to SKILL.md', () => {
    expect(parseSkillsShSource('acme/hook-kit')).toEqual({
      owner: 'acme',
      repo: 'hook-kit',
      entryPath: 'SKILL.md',
    })
    expect(parseSkillsShSource('https://skills.sh/acme/hook-kit')).toMatchObject({
      owner: 'acme',
      repo: 'hook-kit',
      entryPath: 'SKILL.md',
    })
  })

  it('refuses scripts/ and binaries on hosted', () => {
    expect(() => parseSkillsShSource('acme/hook-kit/scripts/run.sh')).toThrow(/scripts/)
    expect(() => assertHostedSkillPathAllowed('skills/foo/scripts/install.sh')).toThrow(/scripts/)
    expect(() =>
      wrapSkillMarkdownAsPack({
        ref: { owner: 'acme', repo: 'x', entryPath: 'tools/run.exe' },
        markdown: '# no',
      }),
    ).toThrow(/binaries|scripts/)
  })

  it('wraps markdown as an unsigned ADR-0039 skill pack', () => {
    const wrapped = wrapSkillMarkdownAsPack({
      ref: { owner: 'acme', repo: 'hook-kit', entryPath: 'SKILL.md' },
      markdown: '---\nname: Hook kit\n---\n\n# Hook kit\n\nOpen on tension.\n',
    })
    expect(wrapped.manifest.kind).toBe('skill')
    expect(wrapped.manifest.entries).toEqual(['SKILL.md'])
    expect(wrapped.manifest.requiresConfirmSpend).toBe(true)
    expect(wrapped.files['SKILL.md']).toMatch(/Open on tension/)
  })

  it('falls back to skills/{repo}/SKILL.md when root is missing', async () => {
    expect(
      skillMarkdownCandidatePaths({ owner: 'acme', repo: 'hook-kit', entryPath: 'SKILL.md' }),
    ).toEqual(['SKILL.md', 'skills/hook-kit/SKILL.md', 'skills/SKILL.md'])
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/HEAD/SKILL.md'))
        return { ok: false, status: 404, text: async () => '' }
      if (String(url).endsWith('/HEAD/skills/hook-kit/SKILL.md')) {
        return { ok: true, status: 200, text: async () => '# Nested skill\n' }
      }
      return { ok: false, status: 404, text: async () => '' }
    })
    const fetched = await fetchSkillMarkdown({
      ref: { owner: 'acme', repo: 'hook-kit', entryPath: 'SKILL.md' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetched.entryPath).toBe('skills/hook-kit/SKILL.md')
    expect(fetched.markdown).toMatch(/Nested skill/)
  })
})
