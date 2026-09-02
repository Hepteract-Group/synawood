import { listMarketingSkills } from '../agent/skills/select'

const CRITIC_SKILL_IDS = new Set(['editor-critic', 'marketing-critic'])

/** Skills for inspect_preview only — not dumped into the chat system prompt. */
export const loadCriticSkillsExcerpt = async (productId?: string): Promise<string> => {
  const skills = (await listMarketingSkills(productId)).filter((skill) =>
    CRITIC_SKILL_IDS.has(skill.id),
  )
  return skills
    .map((skill) => `### ${skill.name} (${skill.id})\n${skill.description}\n\n${skill.excerpt}`)
    .join('\n\n')
}
