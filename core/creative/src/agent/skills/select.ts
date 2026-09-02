import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isMotionGraphicsTurn } from '../motion-brief'

export type MarketingSkillCategory = 'slides' | 'video' | 'core'

export type MarketingSkill = {
  id: string
  name: string
  description: string
  excerpt: string
  category: MarketingSkillCategory
  locked: boolean
}

const here = path.dirname(fileURLToPath(import.meta.url))
// core/creative/src/agent/skills → core/marketing-skills
const coreSkillsRoot = path.resolve(here, '../../../../marketing-skills')
// → products/{productId}/marketing-skills
const productSkillsRoot = (productId: string) =>
  path.resolve(here, `../../../../../products/${productId}/marketing-skills`)

const parseFrontmatter = (
  raw: string,
): {
  name?: string
  description?: string
  category?: MarketingSkillCategory
  locked?: boolean
  body: string
} => {
  if (!raw.startsWith('---')) {
    return { body: raw }
  }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) {
    return { body: raw }
  }
  const front = raw.slice(3, end).trim()
  const body = raw.slice(end + 4).trim()
  const fields: Record<string, string> = {}
  for (const line of front.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  const categoryRaw = fields.category
  const category: MarketingSkillCategory | undefined =
    categoryRaw === 'slides' || categoryRaw === 'video' || categoryRaw === 'core'
      ? categoryRaw
      : undefined
  const locked = fields.locked === 'true' ? true : fields.locked === 'false' ? false : undefined
  return { name: fields.name, description: fields.description, category, locked, body }
}

const loadSkillsFromRoot = async (root: string): Promise<MarketingSkill[]> => {
  let entries: string[] = []
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const skills: MarketingSkill[] = []
  for (const entry of entries) {
    if (entry === 'README.md' || entry.startsWith('.')) continue
    const skillPath = path.join(root, entry, 'SKILL.md')
    try {
      const raw = await readFile(skillPath, 'utf8')
      const parsed = parseFrontmatter(raw)
      const excerpt = parsed.body.slice(0, 900)
      const category: MarketingSkillCategory =
        parsed.category ??
        (entry.startsWith('ad-slide-')
          ? 'slides'
          : entry.startsWith('ad-video-')
            ? 'video'
            : 'core')
      skills.push({
        id: entry,
        name: parsed.name ?? entry,
        description: parsed.description ?? '',
        excerpt,
        category,
        locked: parsed.locked ?? true,
      })
    } catch {
      /* skip incomplete skill folders */
    }
  }
  return skills
}

/** Critic packs are for inspect_preview only — never the chat prompt. */
const CRITIC_ONLY_SKILL_IDS = new Set(['editor-critic', 'marketing-critic'])

export const mergeMarketingSkills = (
  base: readonly MarketingSkill[],
  installed: readonly MarketingSkill[] = [],
): MarketingSkill[] => {
  const byId = new Map<string, MarketingSkill>()
  for (const skill of base) byId.set(skill.id, skill)
  for (const skill of installed) byId.set(skill.id, skill)
  return [...byId.values()]
}

const pinSkill = (
  list: readonly MarketingSkill[],
  extra: MarketingSkill | undefined,
  cap: number,
): MarketingSkill[] => {
  if (!extra) return [...list].slice(0, cap)
  if (list.some((skill) => skill.id === extra.id)) return [...list].slice(0, cap)
  return [...list.filter((skill) => skill.id !== extra.id).slice(0, Math.max(0, cap - 1)), extra]
}

export const listMarketingSkills = async (
  productId?: string,
  installed: readonly MarketingSkill[] = [],
): Promise<MarketingSkill[]> => {
  const core = await loadSkillsFromRoot(coreSkillsRoot)
  if (!productId) return mergeMarketingSkills(core, installed)
  const overlays = await loadSkillsFromRoot(productSkillsRoot(productId))
  return mergeMarketingSkills(mergeMarketingSkills(core, overlays), installed)
}

export const selectMarketingSkills = async (input: {
  productId: string
  userMessage: string
  channelHint?: string
  compositionId?: string
  craft?: 'footage' | 'motion'
  installed?: readonly MarketingSkill[]
}): Promise<MarketingSkill[]> => {
  const installed = input.installed ?? []
  const listed = await listMarketingSkills(input.productId, installed)
  const all = listed.filter((skill) => !CRITIC_ONLY_SKILL_IDS.has(skill.id))
  if (all.length === 0) {
    return []
  }
  const isCampaign =
    input.compositionId === 'campaign-pack-still' ||
    /campaign\s*pack|campaign\s*brief|batch\s*creatives/.test(input.userMessage.toLowerCase())
  const isSlideshow =
    input.compositionId === 'social-carousel' ||
    input.compositionId === 'vertical-slideshow' ||
    /slide|carousel|slideshow|linkedin pack/.test(input.userMessage.toLowerCase())
  const isMotionTurn = isMotionGraphicsTurn({
    userMessage: input.userMessage,
    compositionId: input.compositionId,
    craft: input.craft,
  })
  const isVideoTurn =
    !isSlideshow &&
    (input.compositionId === 'talking-head-60' ||
      isMotionTurn ||
      /video|talking-head|make an ad|b-?roll|polish this take/.test(
        input.userMessage.toLowerCase(),
      ))
  const isMakeAd = isCampaign || isSlideshow || isVideoTurn
  const text =
    `${input.userMessage} ${input.channelHint ?? ''} ${isCampaign ? 'campaign pack brief creatives' : ''}`.toLowerCase()
  const scored = all.map((skill) => {
    let score = 0
    if (isMakeAd && skill.id === 'ad-constitution') score += 6
    if (
      (isSlideshow || isVideoTurn) &&
      (skill.id === 'audience-awareness' ||
        skill.id === 'single-minded-proposition' ||
        skill.id === 'visual-proof' ||
        skill.id === 'cognitive-economy' ||
        skill.id === 'concept-diversity')
    ) {
      score += 5
    }
    if (
      /variant|alternative|another version|more ads/.test(text) &&
      skill.id === 'concept-diversity'
    )
      score += 4
    if (isCampaign && skill.id === 'campaign-brief-drafter') score += 5
    if (isCampaign && skill.id === 'claim-vs-catalog') score += 4
    if (isCampaign && skill.id === 'privacy-claim-safety') score += 3
    if (/hook|title|first 3|attention|cta|copy/.test(text) && skill.id.includes('hooks')) score += 3
    if (/hook|title|cta|copy|caption/.test(text) && skill.id.includes('copywriter')) score += 3
    if (/cut|pace|trim|pack|edit timeline/.test(text) && skill.id.includes('editor-cuts'))
      score += 3
    if (
      /premium|cinematic|urgent|vibe|director|style/.test(text) &&
      skill.id.includes('director-vibes')
    )
      score += 3
    if (/caption|subtitle/.test(text) && skill.id.includes('hooks')) score += 1
    if (/budget|cheap|cost|spend/.test(text) && skill.id.includes('budget')) score += 3
    if (/slide|infographic|carousel/.test(text) && skill.id.includes('infographic')) score += 3
    if (isSlideshow && skill.category === 'slides') score += 4
    if (isSlideshow && skill.id === 'ad-slide-music-bed') score += 5
    if (isSlideshow && skill.id === 'ad-slide-generate-every-bg') score += 2
    if (isVideoTurn && skill.category === 'video') score += 4
    if (/claim|proof|hipaa|compliant|guaranteed/.test(text) && skill.id.includes('claim'))
      score += 3
    if (
      (input.compositionId === 'talking-head-60' ||
        /polish|talking-head|make an ad|enhance this take/.test(text)) &&
      !isMotionTurn &&
      skill.id === 'talking-head-first-pass'
    ) {
      score += 5
    }
    if (isMotionTurn && skill.id === 'motion-variety') score += 6
    // Always keep budget skill lightly available as a guardrail.
    if (skill.id.includes('budget')) score += 0.25
    return { skill, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const cap = isCampaign ? 4 : isSlideshow || isVideoTurn ? 7 : 3
  const scoredPicks = scored
    .filter((item) => item.score >= 1)
    .slice(0, cap)
    .map((item) => item.skill)
  const selected = isSlideshow
    ? pinSkill(
        scoredPicks,
        all.find((skill) => skill.id === 'ad-slide-music-bed'),
        cap,
      )
    : isMotionTurn
      ? pinSkill(
          scoredPicks,
          all.find((skill) => skill.id === 'motion-variety'),
          cap,
        )
      : scoredPicks
  const constitution = all.find((skill) => skill.id === 'ad-constitution')
  const finish = (list: readonly MarketingSkill[]) =>
    mergeMarketingSkills(pinSkill(list, constitution, Math.max(list.length + 1, cap)), installed)
  if (selected.length > 0) {
    return finish(selected)
  }
  if (isCampaign) {
    return finish(
      all.filter(
        (skill) =>
          skill.id === 'campaign-brief-drafter' ||
          skill.id === 'claim-vs-catalog' ||
          skill.id === 'budget-aware-creative' ||
          skill.id === 'ad-constitution',
      ),
    )
  }
  if (isSlideshow) {
    const slides = all.filter(
      (skill) => skill.category === 'slides' || skill.id === 'infographic-clarity',
    )
    return finish(
      pinSkill(
        slides,
        all.find((skill) => skill.id === 'ad-slide-music-bed'),
        7,
      ),
    )
  }
  if (isVideoTurn) {
    return finish(
      all
        .filter(
          (skill) =>
            skill.category === 'video' ||
            skill.id === 'talking-head-first-pass' ||
            skill.id === 'motion-variety',
        )
        .slice(0, 7),
    )
  }
  return finish(
    all.filter((skill) => skill.id === 'hooks-first-3s' || skill.id === 'budget-aware-creative'),
  )
}

export type FirstPartySkillCatalogEntry = MarketingSkill & { markdown: string }

export const listFirstPartySkillCatalog = async (
  productId?: string,
): Promise<FirstPartySkillCatalogEntry[]> => {
  const skills = await listMarketingSkills(productId)
  const entries: FirstPartySkillCatalogEntry[] = []
  for (const skill of skills) {
    const roots = [...(productId ? [productSkillsRoot(productId)] : []), coreSkillsRoot]
    let markdown = skill.excerpt
    for (const rootDir of roots) {
      try {
        const raw = await readFile(path.join(rootDir, skill.id, 'SKILL.md'), 'utf8')
        markdown = parseFrontmatter(raw).body
        break
      } catch {
        /* try next root */
      }
    }
    entries.push({ ...skill, markdown })
  }
  return entries
}
