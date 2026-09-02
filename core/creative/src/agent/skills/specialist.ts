import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// core/creative/src/agent/skills → core/marketing-skills
const skillsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../marketing-skills',
)

export const DIRECTOR_VIBE_IDS = [
  'premium',
  'energetic',
  'urgent',
  'cinematic',
  'informative',
] as const

export type DirectorVibeId = (typeof DIRECTOR_VIBE_IDS)[number]

export type SpecialistPack = {
  pack: string
  /** File stem within the pack (e.g. premium). */
  docId: string
  body: string
  matched: 'exact' | 'mapped' | 'fallback'
  warning?: string
}

const readMd = async (...parts: string[]): Promise<string | null> => {
  try {
    return await readFile(path.join(skillsRoot, ...parts), 'utf8')
  } catch {
    return null
  }
}

/** Keyword map for free-text styles → curated director vibes. */
export const mapStyleToDirectorVibe = (
  style: string | undefined,
): { vibeId: DirectorVibeId; matched: SpecialistPack['matched']; warning?: string } => {
  if (!style?.trim()) {
    return {
      vibeId: 'informative',
      matched: 'fallback',
      warning: 'No style set; using informative.',
    }
  }
  const key = style.trim().toLowerCase()
  if ((DIRECTOR_VIBE_IDS as readonly string[]).includes(key)) {
    return { vibeId: key as DirectorVibeId, matched: 'exact' }
  }

  const rules: Array<{ vibeId: DirectorVibeId; re: RegExp }> = [
    { vibeId: 'premium', re: /premium|luxury|polished|elegant|trust|quiet luxury/ },
    { vibeId: 'energetic', re: /energ|hype|launch|punchy|fast|viral/ },
    { vibeId: 'urgent', re: /urgent|fomo|scarcity|deadline|now|asap|limited/ },
    { vibeId: 'cinematic', re: /cinematic|film|emotional|story|drama|moody/ },
    { vibeId: 'informative', re: /info|explain|how.?to|tutorial|educat|clear|product tour/ },
  ]
  for (const rule of rules) {
    if (rule.re.test(key)) {
      return {
        vibeId: rule.vibeId,
        matched: 'mapped',
        warning: `Free-text style "${style}" mapped to ${rule.vibeId} (best-effort).`,
      }
    }
  }
  return {
    vibeId: 'informative',
    matched: 'fallback',
    warning: `Unknown style "${style}"; fell back to informative.`,
  }
}

/**
 * Load a specialist pack document (ADR-0031).
 * For `director-vibes`, `docOrStyle` is a vibe id or free-text style.
 * For other packs, omit doc to load SKILL.md, or pass a doc stem (e.g. `patterns`).
 */
export const specialistPack = async (
  pack: string,
  docOrStyle?: string,
): Promise<SpecialistPack | null> => {
  if (pack === 'director-vibes') {
    const mapped = mapStyleToDirectorVibe(docOrStyle)
    const body = await readMd(pack, `${mapped.vibeId}.md`)
    if (!body) return null
    return {
      pack,
      docId: mapped.vibeId,
      body: body.trim(),
      matched: mapped.matched,
      warning: mapped.warning,
    }
  }

  if (!docOrStyle || docOrStyle === 'SKILL') {
    const body = await readMd(pack, 'SKILL.md')
    if (!body) return null
    return { pack, docId: 'SKILL', body: body.trim(), matched: 'exact' }
  }

  const body = await readMd(pack, `${docOrStyle}.md`)
  if (!body) return null
  return { pack, docId: docOrStyle, body: body.trim(), matched: 'exact' }
}

export const listSpecialistPackIds = async (): Promise<string[]> => {
  try {
    const entries = await readdir(skillsRoot)
    const packs: string[] = []
    for (const entry of entries) {
      if (entry === 'README.md' || entry.startsWith('.')) continue
      const skill = await readMd(entry, 'SKILL.md')
      if (skill) packs.push(entry)
    }
    return packs.sort()
  } catch {
    return []
  }
}

/** Compact block for Director reasoner prompts. */
export const formatSpecialistPackForPrompt = (pack: SpecialistPack): string => {
  const warn = pack.warning ? `Note: ${pack.warning}` : ''
  return [
    `## Specialist pack: ${pack.pack}/${pack.docId} (${pack.matched})`,
    warn,
    pack.body.slice(0, 2400),
  ]
    .filter(Boolean)
    .join('\n')
}
