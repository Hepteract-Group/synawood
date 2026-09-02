import { describe, expect, it } from 'vitest'
import { generationPlanSchema, parseGenerationPlan } from './schema'

const minimalPlan = {
  id: '44444444-4444-4444-8444-444444444444',
  costEstimateGbp: 1.2,
  projectRevision: 1,
}

describe('generationPlanSchema', () => {
  it('parses a populated plan with dialogue (not script)', () => {
    const plan = parseGenerationPlan({
      ...minimalPlan,
      status: 'ready',
      goal: 'Drive signups',
      tone: 'trustworthy',
      scenes: [
        {
          id: 'gp_hook',
          role: 'hook',
          description: 'Open on the product screen.',
          durationSeconds: 3,
          dialogue: 'Still juggling PDFs by hand?',
          onScreenText: 'the private example',
        },
      ],
      extraExtractUrls: ['https://example.com/pricing'],
      reasonerModelId: 'gemini-2.5-flash',
      imageModelId: 'imagen-4',
      videoModelId: 'veo-3',
    })
    expect(plan.status).toBe('ready')
    expect(plan.scenes[0]?.dialogue).toBe('Still juggling PDFs by hand?')
    expect(plan.extraExtractUrls).toEqual(['https://example.com/pricing'])
    expect(plan.reasonerModelId).toBe('gemini-2.5-flash')
    expect(plan.costEstimateGbp).toBe(1.2)
  })

  it('defaults reExtractThisTurn to false', () => {
    const plan = parseGenerationPlan(minimalPlan)
    expect(plan.reExtractThisTurn).toBe(false)
  })

  it('defaults status to draft and scenes to []', () => {
    const plan = parseGenerationPlan(minimalPlan)
    expect(plan.status).toBe('draft')
    expect(plan.scenes).toEqual([])
  })

  it('rejects unknown fields on the plan', () => {
    expect(() =>
      parseGenerationPlan({
        ...minimalPlan,
        script: 'Do not use script',
      }),
    ).toThrow()
  })

  it('rejects script on scenes — spoken lines must use dialogue', () => {
    expect(() =>
      parseGenerationPlan({
        ...minimalPlan,
        scenes: [
          {
            id: 'gp_hook',
            description: 'Hook beat',
            script: 'Wrong field name',
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects unknown fields on scenes', () => {
    expect(() =>
      parseGenerationPlan({
        ...minimalPlan,
        scenes: [
          {
            id: 'gp_hook',
            description: 'Hook beat',
            voiceover: 'Also wrong',
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => generationPlanSchema.parse({ id: minimalPlan.id })).toThrow()
    expect(() =>
      generationPlanSchema.parse({
        id: minimalPlan.id,
        costEstimateGbp: 0,
      }),
    ).toThrow()
  })
})
