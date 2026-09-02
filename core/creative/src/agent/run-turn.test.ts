import { describe, expect, it, vi } from 'vitest'
import { generateText, stepCountIs, tool } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { z } from 'zod'
import { createEmptyProject, parseStudioProject } from '../project/schema'
import { attachAsset } from '../project'
import { LEGAL_KIT_FIXTURE } from '../authored/fixtures'
import { planMockToolCalls } from './mock-model'

vi.mock('../project/load', () => ({
  loadProject: vi.fn(async () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    return {
      project,
      row: {
        model_profile_id: 'founder-edit',
        reasoner_model_id: null,
      },
    }
  }),
}))

vi.mock('./load-context', () => ({
  loadProductMarketingExcerpt: vi.fn(async () => 'the private example excerpt'),
  loadBrandKitSummary: vi.fn(async () => 'brand summary'),
}))

vi.mock('./skills/select', () => ({
  selectMarketingSkills: vi.fn(async () => [
    {
      id: 'hooks-first-3s',
      name: 'hooks',
      description: 'hooks',
      excerpt: 'hook rules',
      category: 'core',
      locked: true,
    },
  ]),
}))

import { runTurn, resolveReasonerModelId } from './run-turn'

describe('resolveReasonerModelId', () => {
  it('uses project override when set', () => {
    expect(
      resolveReasonerModelId({
        modelProfileId: 'founder-edit',
        reasonerModelId: 'meta/muse-spark-1.1',
      }),
    ).toBe('meta/muse-spark-1.1')
  })

  it('falls back to the profile reasoner', () => {
    expect(resolveReasonerModelId({ modelProfileId: 'founder-edit' })).toBe('openai/gpt-4.1-mini')
  })
})

describe('mock tool planner', () => {
  it('plans add_captions for caption prompts', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const plan = planMockToolCalls('add captions "Hello freelancers"', project)
    expect(plan.toolCalls.some((call) => call.toolName === 'add_captions')).toBe(true)
  })

  it('plans add_text for titles instead of generate_image of words (#703)', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const typed = planMockToolCalls('add a title "Stuck on a PDF?"', project)
    expect(typed.toolCalls.some((call) => call.toolName === 'add_text')).toBe(true)
    expect(typed.toolCalls.some((call) => call.toolName === 'generate_image')).toBe(false)

    const fakeStill = planMockToolCalls('generate an image of the words Hello freelancers', project)
    expect(fakeStill.toolCalls.some((call) => call.toolName === 'add_text')).toBe(true)
    expect(fakeStill.toolCalls.some((call) => call.toolName === 'generate_image')).toBe(false)
  })

  it('plans add_clip for Add @asset … at 5 seconds', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const assetId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    project.assets.push({
      id: assetId,
      kind: 'image',
      blobKey: 'brand/stills/editor-truth.svg',
      contentType: 'image/svg+xml',
      source: 'brand_kit',
      probe: { brandKitPath: 'stills/editor-truth.svg' },
    })
    const token = `@asset:stills-editor-truth-svg-${assetId.slice(0, 8)}`
    const plan = planMockToolCalls(
      `Add ${token} to thefootage at 5 seconds into the video`,
      project,
    )
    const add = plan.toolCalls.find((call) => call.toolName === 'add_clip')
    expect(add).toBeTruthy()
    const input = JSON.parse(add!.input) as { assetId: string; from: number }
    expect(input.assetId).toBe(assetId)
    expect(input.from).toBe(150)
  })

  it('plans generate_video_clip for produce a 25s ad', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const plan = planMockToolCalls('produce a 25s ad for okiki alaso', project)
    expect(plan.toolCalls.some((call) => call.toolName === 'generate_video_clip')).toBe(true)
  })

  it('plans write_composition for a kinetic type brief (#1196)', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const plan = planMockToolCalls('30s kinetic type on the pricing claim', project)
    expect(plan.toolCalls.some((call) => call.toolName === 'write_composition')).toBe(true)
    expect(plan.toolCalls.some((call) => call.toolName === 'generate_video_clip')).toBe(false)
    expect(plan.toolCalls.some((call) => call.toolName === 'add_clip')).toBe(false)
  })

  it('plans find_moments before generate_image on a kinetic brief with library stills (#1198)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = {
      ...project,
      brand: {
        productId: 'demo',
        displayName: 'Povotra',
      },
    }
    project = attachAsset(project, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'image',
      blobKey: 'local/marketing-os/demo/library/ui.png',
      source: 'upload',
      probe: {},
    })
    const plan = planMockToolCalls('30s kinetic type on the pricing claim', project)
    const names = plan.toolCalls.map((call) => call.toolName)
    const findIdx = names.indexOf('find_moments')
    const genIdx = names.indexOf('generate_image')
    expect(findIdx).toBeGreaterThanOrEqual(0)
    expect(genIdx).toBe(-1)
    expect(findIdx).toBeLessThan(names.indexOf('write_composition'))
  })

  it('plans patch_composition on “fix it” when authored compile failed (#1263)', () => {
    const project = parseStudioProject({
      ...createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
        compositionId: 'authored',
      }),
      compositionSource: {
        source: `import fs from 'node:fs'\n${LEGAL_KIT_FIXTURE}`,
        motionSeed: 'seed-fix-1',
        compileError: 'Line 1: Blocked import "node:fs"',
      },
    })
    const plan = planMockToolCalls('fix it, continue till its done', project)
    const names = plan.toolCalls.map((call) => call.toolName)
    expect(names).toContain('patch_composition')
    expect(names).not.toContain('generate_image')
    expect(names).not.toContain('add_clip')
    expect(names).not.toContain('generate_video_clip')
  })

  it('plans extract_product_pages for an extract URL — not music or write (#1365)', () => {
    const project = parseStudioProject({
      ...createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
        compositionId: 'authored',
      }),
      compositionSource: {
        source: LEGAL_KIT_FIXTURE,
        motionSeed: 'seed-extract-1',
        compileError: 'Export a default React component from the composition source',
      },
    })
    const plan = planMockToolCalls(
      'Extract this product page and keep usable stills in the Extracts bin: https://povotra.com',
      project,
    )
    const names = plan.toolCalls.map((call) => call.toolName)
    expect(names[0]).toBe('extract_product_pages')
    expect(names).not.toContain('generate_music')
    expect(names).not.toContain('write_composition')
  })

  it('plans generate_music for a carousel music-bed prompt (#1016)', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const plan = planMockToolCalls(
      'Add background music to the carousel. Make it orchestra music',
      project,
    )
    const music = plan.toolCalls.find((call) => call.toolName === 'generate_music')
    expect(music).toBeTruthy()
    const input = JSON.parse(music!.input) as {
      placeOnTimeline: boolean
      forceInstrumental: boolean
    }
    expect(input.placeOnTimeline).toBe(true)
    expect(input.forceInstrumental).toBe(true)
  })

  it('covers proof with close-ups via find_moments before generate (#526)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = {
      ...project,
      assets: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          kind: 'video',
          blobKey: 'local/proof.mp4',
          source: 'upload',
          probe: { durationFrames: 300 },
        },
      ],
    }
    const plan = planMockToolCalls('cover proof with close-ups', project)
    const names = plan.toolCalls.map((call) => call.toolName)
    expect(names[0]).toBe('find_moments')
    expect(names).toContain('assemble_broll')
    expect(names[0]).not.toBe('generate_video_clip')
    const find = plan.toolCalls.find((call) => call.toolName === 'find_moments')
    expect(find).toBeDefined()
    expect(JSON.parse(find!.input)).toEqual(
      expect.objectContaining({ sceneRole: 'proof', query: expect.stringMatching(/close-up/i) }),
    )
  })
})

describe('harness guardrails', () => {
  it('stops after max steps when the model keeps calling tools', async () => {
    let calls = 0
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        calls += 1
        return {
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: String(calls),
              toolName: 'ping',
              input: JSON.stringify({ n: calls }),
            },
          ],
          finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      },
    })

    const result = await generateText({
      model,
      prompt: 'loop',
      tools: {
        ping: tool({
          description: 'ping',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }) => ({ n }),
        }),
      },
      stopWhen: stepCountIs(3),
    })

    expect(result.steps.length).toBe(3)
    expect(calls).toBe(3)
  })

  it('honours abort signals when the model checks the signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      generateText({
        model: new MockLanguageModelV3({
          doGenerate: async ({ abortSignal }) => {
            if (abortSignal?.aborted) {
              throw new Error('Turn cancelled')
            }
            return {
              content: [{ type: 'text' as const, text: 'nope' }],
              finishReason: { unified: 'stop' as const, raw: 'stop' },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 1, text: 1, reasoning: undefined },
              },
              warnings: [],
            }
          },
        }),
        prompt: 'hi',
        abortSignal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/i)
  })
})

describe('runTurn mock profile', () => {
  it('runs add captions through allowlisted tools without a paid key', async () => {
    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'add captions "Edit PDFs without Adobe"',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
      },
    )

    expect(
      result.toolTrace.some((entry) => entry.toolName === 'add_captions' && entry.outcome.ok),
    ).toBe(true)
    expect(result.project.overlays.some((overlay) => overlay.kind === 'caption')).toBe(true)
    expect(result.assistantText).toMatch(/caption/i)
    expect(result.skillIds).toContain('hooks-first-3s')
    const last = result.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.activity?.some((entry) => entry.toolName === 'add_captions')).toBe(true)
  })

  it('grounds assistant text when the model narrates without calling tools', async () => {
    const model = new MockLanguageModelV3({
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

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'generate an end screen image',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(result.toolTrace).toHaveLength(0)
    expect(result.assistantText).toMatch(/no tools ran/i)
    expect(result.assistantText).not.toMatch(/please wait/i)
  })

  it('blocks make-a-video narration when inspect_preview did not run', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [
          {
            type: 'text' as const,
            text: 'The video is done.',
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

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'Make a 30s video for the private example',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(result.assistantText).toMatch(/not calling this done/i)
    expect(result.assistantText).not.toMatch(/cannot say the video is done/i)
    expect(result.assistantText).not.toMatch(/^The video is done/)
  })

  it('fails visibly when a reasoner skips generate on make-an-ad (#613)', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [
          {
            type: 'text' as const,
            text: 'Here is your 15s ad. Looking great.',
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

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'produce a 15s ad for okiki alaso',
        modelProfileId: 'ci-stub',
        confirmSpend: true,
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(result.toolTrace.some((entry) => entry.toolName === 'generate_video_clip')).toBe(false)
    expect(result.assistantText).toMatch(/Nothing was generated/)
    expect(result.assistantText).toMatch(/did not call tools/)
    expect(result.assistantText).not.toMatch(/Looking great/)
  })

  it('fails visibly when a reasoner claims a music bed without generate_music (#1016)', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [
          {
            type: 'text' as const,
            text: 'Carousel now has a cinematic orchestral bed placed on the audio track — calm strings, soft piano, gentle pulses underneath the slides.',
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

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'Add background music to the carousel. Make it orchestra music',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(result.toolTrace.some((entry) => entry.toolName === 'generate_music')).toBe(false)
    expect(result.assistantText).toMatch(/no music was generated/i)
    expect(result.assistantText).not.toMatch(/orchestral bed/i)
    expect(result.assistantText).not.toMatch(/placed on the audio track/i)
  })

  it('fails visibly when a reasoner claims VO without generate_voiceover', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [
          {
            type: 'text' as const,
            text: 'Built it faster, bigger, with VO. Dropped a warm-female mid-20s voiceover onto the audio track.',
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

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'Add the voice over. Make it a warm female in her mid-20s.',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(result.toolTrace.some((entry) => entry.toolName === 'generate_voiceover')).toBe(false)
    expect(result.assistantText).toMatch(/no voiceover was generated/i)
    expect(result.assistantText).not.toMatch(/warm-female/)
  })

  it('fails out loud when generate_video_clip is disabled (#962)', async () => {
    let modelCalls = 0
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        modelCalls += 1
        return {
          content: [{ type: 'text' as const, text: 'should not run' }],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      },
    })

    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { disabled_optional_tools: ['generate_video_clip'] },
              error: null,
            }),
          }),
        }),
      })),
    }

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'make a 30s video for the launch',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: supabase as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(modelCalls).toBe(0)
    expect(result.assistantText).toMatch(/generate_video_clip/i)
    expect(result.assistantText).toMatch(/Cut review is not skipped/i)
    expect(result.messages.filter((message) => message.role === 'user')).toHaveLength(1)
    expect(result.toolTrace).toEqual([])
  })
})

describe('runTurn confirmed-plan generate (#1065)', () => {
  it('fails visibly when confirmed plan turn narrates without generating', async () => {
    const { loadProject } = await import('../project/load')
    vi.mocked(loadProject).mockImplementationOnce(async () => {
      const project = createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
      })
      return {
        project: {
          ...project,
          generationPlan: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            status: 'ready' as const,
            scenes: [],
            costEstimateGbp: 1.6,
            projectRevision: 1,
            videoModelId: 'google/veo-3.1-fast-generate-001',
            reasonerModelId: 'mock-reasoner',
            reExtractThisTurn: false,
          },
        },
        row: { model_profile_id: 'ci-stub', reasoner_model_id: null, video_model_id: null },
      } as unknown as Awaited<ReturnType<typeof loadProject>>
    })

    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text' as const, text: 'Your ad is ready, here is the plan summary.' }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      }),
    })

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'Generate video from the approved plan',
        modelProfileId: 'ci-stub',
        confirmSpend: true,
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(result.assistantText).toMatch(/Nothing was generated/)
    expect(result.assistantText).toMatch(/did not call tools/)
    expect(result.assistantText).not.toMatch(/Your ad is ready/)
  })

  it('does not fire MISSING_GENERATE when plan was drafted this turn (plan-first flow)', async () => {
    const { loadProject } = await import('../project/load')
    vi.mocked(loadProject).mockImplementationOnce(async () => {
      const project = createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
      })
      return {
        project,
        row: { model_profile_id: 'ci-stub', reasoner_model_id: null, video_model_id: null },
      } as unknown as Awaited<ReturnType<typeof loadProject>>
    })

    const model = new MockLanguageModelV3({
      doGenerate: async (options) => {
        // Simulate agent calling draft_generation_plan on step 0
        const toolChoice = (options as { toolChoice?: { toolName?: string } }).toolChoice
        if (toolChoice && typeof toolChoice === 'object' && 'toolName' in toolChoice) {
          return {
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'tc1',
                toolName: 'draft_generation_plan',
                input: JSON.stringify({ scenes: [] }),
              },
            ],
            finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
            warnings: [],
          }
        }
        return {
          content: [{ type: 'text' as const, text: 'Plan drafted, please review and confirm.' }],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      },
    })

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'produce a 15s ad for okiki alaso',
        modelProfileId: 'ci-stub',
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    // Plan draft is valid first step — must NOT show MISSING_GENERATE_MESSAGE
    expect(result.assistantText).not.toMatch(/Nothing was generated/)
    expect(result.assistantText).not.toMatch(/did not call tools/)
  })
})

describe('runTurn authored write force (#1328)', () => {
  it('does not let Execute narrate a write when inspect failed and no write ran', async () => {
    const { loadProject } = await import('../project/load')
    vi.mocked(loadProject).mockImplementationOnce(async () => {
      const project = createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
        compositionId: 'authored',
      })
      return {
        project: {
          ...project,
          compositionSource: {
            source: 'export default () => null; // long enough placeholder source xx',
            motionSeed: '11111111-1111-4111-8111-111111111111',
          },
          cutReview: {
            passed: false,
            fingerprint: 'x',
            frames: [0],
            at: new Date().toISOString(),
          },
        },
        row: {
          model_profile_id: 'ci-stub',
          reasoner_model_id: 'mock-reasoner',
          video_model_id: null,
        },
      } as unknown as Awaited<ReturnType<typeof loadProject>>
    })

    let forcedTool: string | undefined
    const model = new MockLanguageModelV3({
      doGenerate: async (options) => {
        const toolChoice = (options as { toolChoice?: { toolName?: string } }).toolChoice
        if (toolChoice && typeof toolChoice === 'object' && 'toolName' in toolChoice) {
          forcedTool = toolChoice.toolName
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Implementation kicked off — TSX written with per-beat local clocks.',
            },
          ],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      },
    })

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'compilation failed. fix it — the player is black',
        modelProfileId: 'ci-stub',
        turnMode: 'execute',
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(forcedTool).toBe('write_composition')
    expect(result.assistantText).toMatch(/Nothing was written to the Player/)
    expect(result.assistantText).not.toMatch(/kicked off/)
  })

  it('forces extract_product_pages — not write or music — on an extract URL (#1365)', async () => {
    const { loadProject } = await import('../project/load')
    vi.mocked(loadProject).mockImplementationOnce(async () => {
      const project = createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
        compositionId: 'authored',
      })
      return {
        project: {
          ...project,
          compositionSource: {
            source: '',
            motionSeed: '11111111-1111-4111-8111-111111111111',
          },
        },
        row: {
          model_profile_id: 'ci-stub',
          reasoner_model_id: 'mock-reasoner',
          video_model_id: null,
        },
      } as unknown as Awaited<ReturnType<typeof loadProject>>
    })

    const forced: string[] = []
    let toolNames: string[] = []
    const model = new MockLanguageModelV3({
      doGenerate: async (options) => {
        toolNames = (options.tools ?? []).map((t: { name: string }) => t.name)
        const toolChoice = (options as { toolChoice?: { toolName?: string } }).toolChoice
        if (toolChoice && typeof toolChoice === 'object' && 'toolName' in toolChoice) {
          forced.push(toolChoice.toolName ?? '')
        }
        return {
          content: [{ type: 'text' as const, text: 'Queued a music bed instead.' }],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      },
    })

    const result = await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage:
          'Extract this product page and keep usable stills in the Extracts bin: https://povotra.com',
        modelProfileId: 'ci-stub',
        turnMode: 'execute',
        confirmSpend: true,
      },
      {
        supabase: { from: vi.fn() } as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(forced[0]).toBe('extract_product_pages')
    expect(forced).not.toContain('generate_music')
    expect(forced).not.toContain('write_composition')
    expect(toolNames).toContain('extract_product_pages')
    expect(toolNames).not.toContain('generate_music')
    expect(toolNames).not.toContain('write_composition')
    expect(result.assistantText).toMatch(/No extract was queued/)
    expect(result.assistantText).not.toMatch(/music bed/)
  })
})
describe('runTurn MCP tool integration (#1087)', () => {
  const SERVER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

  it('merges an enabled MCP tool into the SDK tools map passed to generateText', async () => {
    const { safeMcpToolName } = await import('../mcp/inbound-tools')
    const { mcpToolCatalogId } = await import('../mcp/inbound')
    const catalogId = mcpToolCatalogId(SERVER_ID, 'mcp_search')
    const sdkToolName = safeMcpToolName(catalogId)

    let capturedToolNames: string[] = []
    const model = new MockLanguageModelV3({
      doGenerate: async (options) => {
        capturedToolNames = (options.tools ?? []).map((t: { name: string }) => t.name)
        return {
          content: [{ type: 'text' as const, text: 'done' }],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      },
    })

    const buildChain = (rows: unknown[]) => ({
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
      order: () => ({
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      }),
    })

    const supabase = {
      from: vi.fn((table: string) => ({
        select: () => {
          if (table === 'products')
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: { disabled_optional_tools: [] },
                  error: null,
                }),
              }),
            }
          if (table === 'mcp_servers')
            return {
              eq: () =>
                buildChain([
                  {
                    id: SERVER_ID,
                    endpoint: 'https://mcp.example.com/sse',
                    auth_ciphertext: null,
                    auth_nonce: null,
                  },
                ]),
            }
          if (table === 'mcp_enabled_tools')
            return {
              in: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () =>
                      buildChain([
                        {
                          server_id: SERVER_ID,
                          tool_name: 'mcp_search',
                          description: 'MCP search tool',
                          input_schema: { type: 'object' },
                        },
                      ]),
                  }),
                }),
              }),
            }
          return { eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }
        },
      })),
    }

    await runTurn(
      {
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        messages: [],
        userMessage: 'search with MCP',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: supabase as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(capturedToolNames).toContain(sdkToolName)
    expect(sdkToolName).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('excludes disabled or stale MCP tools from the SDK tools map', async () => {
    const { safeMcpToolName } = await import('../mcp/inbound-tools')
    const { mcpToolCatalogId } = await import('../mcp/inbound')
    const catalogId = mcpToolCatalogId(SERVER_ID, 'stale_tool')
    const sdkToolName = safeMcpToolName(catalogId)

    let capturedToolNames: string[] = []
    const model = new MockLanguageModelV3({
      doGenerate: async (options) => {
        capturedToolNames = (options.tools ?? []).map((t: { name: string }) => t.name)
        return {
          content: [{ type: 'text' as const, text: 'done' }],
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        }
      },
    })

    const supabase = {
      from: vi.fn((table: string) => ({
        select: () => {
          if (table === 'products')
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: { disabled_optional_tools: [] },
                  error: null,
                }),
              }),
            }
          // No MCP servers → loadEnabledMcpToolsForTurn returns []
          if (table === 'mcp_servers')
            return {
              eq: () => ({
                then: (resolve: (v: unknown) => unknown) =>
                  Promise.resolve({ data: [], error: null }).then(resolve),
              }),
            }
          return { eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }
        },
      })),
    }

    await runTurn(
      {
        productId: 'demo',
        projectId: '33333333-3333-4333-8333-333333333333',
        messages: [],
        userMessage: 'try stale tool',
        modelProfileId: 'founder-edit',
      },
      {
        supabase: supabase as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        persist: false,
        model,
      },
    )

    expect(capturedToolNames).not.toContain(sdkToolName)
  })
})
