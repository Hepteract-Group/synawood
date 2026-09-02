import { describe, expect, it } from 'vitest'
import { listFirstPartySkillCatalog, listMarketingSkills, selectMarketingSkills } from './select'

describe('selectMarketingSkills', () => {
  it('selects hooks skill for hook-oriented prompts', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'set a strong hook title for the first 3 seconds',
    })
    expect(skills.some((skill) => skill.id === 'hooks-first-3s')).toBe(true)
    expect(skills.some((skill) => skill.id === 'ad-constitution')).toBe(true)
    expect(skills.length).toBeLessThanOrEqual(4)
  })

  it('selects budget skill when spend is mentioned', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'keep this cheap — we are near budget',
    })
    expect(skills.some((skill) => skill.id === 'budget-aware-creative')).toBe(true)
  })

  it('selects campaign brief + claim skills for campaign packs', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'draft a campaign brief and creatives',
      compositionId: 'campaign-pack-still',
    })
    expect(skills.some((skill) => skill.id === 'campaign-brief-drafter')).toBe(true)
    expect(skills.some((skill) => skill.id === 'claim-vs-catalog')).toBe(true)
    expect(skills.some((skill) => skill.id === 'ad-constitution')).toBe(true)
  })

  it('selects talking-head first pass when they ask to polish a take (#886)', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'polish this talking-head take',
      compositionId: 'talking-head-60',
    })
    expect(skills.some((skill) => skill.id === 'talking-head-first-pass')).toBe(true)
    expect(skills.some((skill) => skill.id === 'ad-constitution')).toBe(true)
    expect(
      skills.some((skill) => skill.id === 'editor-critic' || skill.id === 'marketing-critic'),
    ).toBe(false)
    expect(skills.some((skill) => /Producer|Quick Design/.test(skill.excerpt))).toBe(false)
    const skill = skills.find((item) => item.id === 'talking-head-first-pass')
    expect(skill?.excerpt).toMatch(/inspect_preview/)
  })
})

it('lists and always selects an enabled installed fixture pack (#953)', async () => {
  const fixture = {
    id: 'installed:pattern-interrupt',
    name: 'Pattern interrupt',
    description: 'Open with a jolt, then the offer.',
    excerpt: 'First frame must break the scroll. Then name the product.',
    category: 'core' as const,
    locked: false,
  }
  const listed = await listMarketingSkills('demo', [fixture])
  expect(listed.some((skill) => skill.id === 'installed:pattern-interrupt')).toBe(true)

  const selected = await selectMarketingSkills({
    productId: 'demo',
    userMessage: 'hello',
    installed: [fixture],
  })
  expect(selected.some((skill) => skill.id === 'installed:pattern-interrupt')).toBe(true)
  expect(selected.find((skill) => skill.id === 'installed:pattern-interrupt')?.excerpt).toMatch(
    /break the scroll/,
  )
})

it('lets an installed pack win on the same id as a first-party skill (#953)', async () => {
  const overlay = {
    id: 'hooks-first-3s',
    name: 'Hooks overlay',
    description: 'Installed overlay',
    excerpt: 'Installed pack excerpt for hooks.',
    category: 'core' as const,
    locked: false,
  }
  const listed = await listMarketingSkills('demo', [overlay])
  expect(listed.find((skill) => skill.id === 'hooks-first-3s')?.excerpt).toBe(
    'Installed pack excerpt for hooks.',
  )
})

describe('first-party skill catalog (#955)', () => {
  it('lists first-party skills with readable markdown, not scripts', async () => {
    const catalog = await listFirstPartySkillCatalog('demo')
    expect(catalog.length).toBeGreaterThan(0)
    const hooks = catalog.find((skill) => skill.id === 'hooks-first-3s')
    expect(hooks?.markdown.length).toBeGreaterThan(80)
    expect(hooks?.markdown).not.toMatch(/<script/i)
    expect(catalog.every((skill) => skill.id && skill.name && skill.markdown)).toBe(true)
    expect(catalog.every((skill) => skill.locked)).toBe(true)
    expect(catalog.filter((skill) => skill.category === 'slides').length).toBeGreaterThanOrEqual(25)
    expect(catalog.filter((skill) => skill.category === 'video').length).toBeGreaterThanOrEqual(25)
  })

  it('selects locked slide skills for a carousel ask (#1011)', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'make a LinkedIn carousel',
      compositionId: 'talking-head-60',
    })
    expect(
      skills.some((skill) => skill.category === 'slides' || skill.id === 'infographic-clarity'),
    ).toBe(true)
    expect(skills.length).toBeGreaterThan(2)
    expect(skills.some((skill) => skill.id === 'ad-slide-music-bed')).toBe(true)
    expect(skills.some((skill) => skill.id === 'ad-constitution')).toBe(true)
  })

  it('pins ad-constitution on authored make-ad and keeps critic packs out of chat (#1245)', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'make a kinetic type ad',
      compositionId: 'authored',
    })
    expect(skills.some((skill) => skill.id === 'ad-constitution')).toBe(true)
    expect(skills.some((skill) => skill.id === 'audience-awareness')).toBe(true)
    expect(skills.some((skill) => skill.id === 'visual-proof')).toBe(true)
    expect(skills.some((skill) => skill.id === 'editor-critic')).toBe(false)
    expect(skills.some((skill) => skill.id === 'marketing-critic')).toBe(false)
  })

  it('pins audience-awareness on make-ad with Synawood vocabulary in the excerpt (#1222)', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'make a kinetic type ad',
      compositionId: 'authored',
    })
    const pack = skills.find((skill) => skill.id === 'audience-awareness')
    expect(pack).toBeDefined()
    expect(pack?.excerpt).toMatch(/persona/)
    expect(pack?.excerpt).toMatch(/awarenessStage/)
    expect(pack?.excerpt).toMatch(/primaryPain/)
    expect(pack?.excerpt).toMatch(/problem-aware/)
    expect(pack?.excerpt).toMatch(/unaware/)
    expect(pack?.excerpt).toMatch(/everyone/)
  })

  it('pins single-minded-proposition on make-ad with primaryMessage in the excerpt (#1224)', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'make a kinetic type ad',
      compositionId: 'authored',
    })
    const pack = skills.find((skill) => skill.id === 'single-minded-proposition')
    expect(pack).toBeDefined()
    expect(pack?.excerpt).toMatch(/primaryMessage/)
    expect(pack?.excerpt).toMatch(/supportingPoints/)
  })

  it('selects motion-variety for kinetic type and skips talking-head first pass (#1196)', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'make a kinetic type ad',
    })
    expect(skills.some((skill) => skill.id === 'motion-variety')).toBe(true)
    expect(skills.some((skill) => skill.id === 'ad-constitution')).toBe(true)
    expect(skills.some((skill) => skill.id === 'talking-head-first-pass')).toBe(false)
    expect(skills.find((skill) => skill.id === 'motion-variety')?.excerpt).toMatch(
      /write_composition/,
    )
  })

  it('pins motion-variety on authored craft without kinetic keywords (#1326)', async () => {
    const skills = await selectMarketingSkills({
      productId: 'demo',
      userMessage: 'fix the type and keep going',
      compositionId: 'authored',
      craft: 'motion',
    })
    expect(skills.some((skill) => skill.id === 'motion-variety')).toBe(true)
    expect(skills.some((skill) => skill.id === 'talking-head-first-pass')).toBe(false)
  })
})
