import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'
import { createEmptyProject } from '../../project/schema'
import { runTurn } from '../run-turn'
import { EVAL_FIXTURES } from './fixtures'
import { buildScorecard, formatScorecard, scoreFixture } from './scorecard'
import type { StudioProject } from '../../project/schema'

const blobEnv = {
  connectionString: 'x',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'a',
  accountKey: 'k',
}

let currentProject: StudioProject = createEmptyProject({
  id: '22222222-2222-4222-8222-222222222222',
  productId: 'demo',
})

vi.mock('../../project/load', () => ({
  loadProject: vi.fn(async () => ({
    project: currentProject,
    row: { model_profile_id: 'founder-edit', reasoner_model_id: null },
  })),
}))

vi.mock('../load-context', () => ({
  loadProductMarketingExcerpt: vi.fn(async () => 'the private example excerpt'),
  loadBrandKitSummary: vi.fn(async () => 'brand summary'),
}))

vi.mock('../skills/select', () => ({
  selectMarketingSkills: vi.fn(async () => []),
}))

const analyzeOnlyModel = () => {
  let call = 0
  return new MockLanguageModelV3({
    doGenerate: async () => {
      call += 1
      if (call === 1) {
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: '1',
              toolName: 'analyze_asset',
              input: JSON.stringify({
                assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                prompt: 'segment this take',
                kind: 'segment',
                schema: { type: 'object' },
              }),
            },
          ],
          finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      }
      return {
        content: [{ type: 'text' as const, text: 'The video is done.' }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      }
    },
  })
}

const narrateOnlyModel = () =>
  new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [
        {
          type: 'text' as const,
          text: 'Please wait while I process the request. I will generate the image.',
        },
      ],
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  })

describe('Studio Agent eval harness (mock reasoner)', () => {
  beforeEach(() => {
    currentProject = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
  })

  it('produces a scorecard with all fixtures passing', async () => {
    const results = []
    for (const fixture of EVAL_FIXTURES) {
      const score = await scoreFixture(fixture, async () => {
        currentProject = fixture.setupProject()
        const result = await runTurn(
          {
            productId: 'demo',
            projectId: currentProject.id,
            messages: [],
            userMessage: fixture.userMessage,
            modelProfileId: fixture.id === 'generate-image-stub' ? 'ci-stub' : 'founder-edit',
          },
          {
            supabase: { from: vi.fn() } as never,
            blobEnv,
            persist: false,
            ...(fixture.narrateOnly ? { model: narrateOnlyModel() } : {}),
            ...(fixture.scripted === 'analyze-only' ? { model: analyzeOnlyModel() } : {}),
          },
        )
        fixture.assert(result)
      })
      results.push(score)
    }

    const card = buildScorecard('mock-reasoner', results)
    // eslint-disable-next-line no-console
    console.log(formatScorecard(card))
    expect(card.failed).toBe(0)
    expect(card.passed).toBe(EVAL_FIXTURES.length)
  })
})
