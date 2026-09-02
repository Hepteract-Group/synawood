import { generateText, stepCountIs, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlobEnv } from '../persistence/blob'
import { DEFAULT_MODEL_PROFILE_ID, getModelProfile, isToolEnabled } from '../model-profiles'
import {
  estimateReasonerGbp,
  readCreativeBudgets,
  recordCostEvent,
  sumCostEventsGbp,
} from '../pricing'
import { loadProject } from '../project/load'
import { summarizeProject } from '../project/summary'
import { craftFromComposition } from '../project/schema'
import { createStudioTools } from '../tools/studio-tools'
import { MISSING_EXTRACT_MESSAGE } from '../tools/extract-product-pages-tool'
import {
  MAKE_VIDEO_DISABLED_MESSAGE,
  omitDisabledOptionalTools,
  sanitizeDisabledOptionalTools,
  videoGenerateIsDisabled,
} from '../tools/first-party-catalog'
import { isMakeVideoRequest } from '../critic/inspect-preview'
import type { StudioToolContext, ToolTraceEntry } from '../tools/types'
import { listProductExtracts } from '../extract/list-product-extracts'
import {
  listAssetAnalysesForAssets,
  motionScenePlanContextBlock,
  motionScenePlanFromAnalyses,
} from '../asset-intelligence'
import { loadBrandKitSummary, loadProductMarketingExcerpt } from './load-context'
import { resolveAssetReferences } from '../project/asset-token'
import { groundingReferenceBlock, resolveChatGrounding } from '../project/grounding-token'
import { resolveSlideReferences } from '../project/slide-token'
import { assetReferenceBlock } from './asset-references'
import { productExtractContextBlock } from './product-extract-context'
import { slideReferenceBlock } from './slide-references'
import { selectMarketingSkills } from './skills/select'
import { listInstalledPackSkills } from '../packs/loader'
import { groundAssistantText } from './ground-assistant-text'
import { summarizeIntentScenes } from '../intent'
import { buildSystemPrompt } from './system-prompt'
import { applyCutReviewNarration } from '../critic/inspect-preview'
import {
  omitToolsForTurnMode,
  parseTurnMode,
  resolveTurnMode,
  turnModeAllowsGenerate,
} from './turn-mode'
import {
  forcedFirstGenerateTool,
  isMissingGenerate,
  MISSING_GENERATE_MESSAGE,
  MISSING_MUSIC_MESSAGE,
  MISSING_VOICEOVER_MESSAGE,
  shouldForceMusicGenerate,
  shouldForceGenerateFromPlan,
  shouldForceVideoGenerate,
  shouldForceVoiceoverGenerate,
  turnCalledDraftPlan,
  turnCalledGenerateMusic,
  turnCalledGenerateVideo,
  turnCalledGenerateVoiceover,
} from './force-generate'
import {
  MISSING_WRITE_COMPOSITION_MESSAGE,
  forcedToolForStep,
  shouldForcePatchComposition,
  shouldForceWriteComposition,
  turnCalledWriteComposition,
} from './force-write-composition'
import { classifyTurnJob, omitToolsForExtractJob } from './turn-job'
import {
  projectHasMusicBed,
  projectHasVoiceover,
  remainingBriefVideoSeconds,
} from '../project/picture-completeness'
import { isMotionGraphicsTurn } from './motion-brief'
import { resolveTurnMaxSteps } from './max-steps'
import {
  type ChatMessage,
  type ReasonerSpend,
  type RunTurnInput,
  type RunTurnResult,
} from './types'
import { buildMcpToolSet } from '../mcp/inbound-tools'
import { loadEnabledMcpToolsForTurn } from '../mcp/inbound'
import { toolNamesFromModelContent, type TurnLiveEvent } from './live-trace'

export type RunTurnDeps = {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  modelProfileId?: string
  persist?: boolean
  /** Override reasoner (tests). */
  model?: LanguageModel
  onToolStart?: (toolName: string) => void | Promise<void>
  onTool?: (entry: ToolTraceEntry) => void
  /** SSE: model step / tool choice before execute (#1274). */
  onLive?: (event: TurnLiveEvent) => void | Promise<void>
}

/** Effective reasoner model id: project override wins, else profile reasoner. */
export const resolveReasonerModelId = (input: {
  modelProfileId: string
  reasonerModelId?: string | null
}): string => {
  const override = input.reasonerModelId?.trim()
  if (override) return override
  return getModelProfile(input.modelProfileId).reasoner.modelId
}

/**
 * Mock only when the effective reasoner id is mock-reasoner, or no paid credentials exist.
 * With `AI_GATEWAY_API_KEY`, real model ids route through Gateway. `OPENAI_API_KEY` remains
 * a direct-OpenAI fallback for openai/* ids.
 */
export const resolveReasoner = async (input: {
  modelProfileId: string
  reasonerModelId?: string | null
  userMessage: string
  project: RunTurnResult['project']
  override?: LanguageModel
}): Promise<{ model: LanguageModel; reasonerModelId: string }> => {
  if (input.override) {
    return {
      model: input.override,
      reasonerModelId: resolveReasonerModelId(input),
    }
  }

  const reasonerModelId = resolveReasonerModelId(input)

  if (reasonerModelId === 'mock-reasoner') {
    const { createMockReasoner } = await import('./mock-model')
    return {
      model: createMockReasoner({
        userMessage: input.userMessage,
        project: input.project,
      }),
      reasonerModelId,
    }
  }

  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return { model: reasonerModelId, reasonerModelId }
  }

  if (process.env.OPENAI_API_KEY?.trim() && reasonerModelId.startsWith('openai/')) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelName = process.env.STUDIO_REASONER_MODEL ?? reasonerModelId.replace(/^openai\//, '')
    return { model: openai(modelName), reasonerModelId }
  }

  const { createMockReasoner } = await import('./mock-model')
  return {
    model: createMockReasoner({
      userMessage: input.userMessage,
      project: input.project,
    }),
    reasonerModelId: 'mock-reasoner',
  }
}

const usageTokens = (usage: unknown): { inputTokens: number; outputTokens: number } => {
  const u = usage as
    | {
        inputTokens?: number | { total?: number }
        outputTokens?: number | { total?: number; text?: number }
        promptTokens?: number
        completionTokens?: number
      }
    | undefined
  if (!u) return { inputTokens: 0, outputTokens: 0 }
  const input =
    typeof u.inputTokens === 'number'
      ? u.inputTokens
      : typeof u.inputTokens === 'object'
        ? (u.inputTokens.total ?? 0)
        : (u.promptTokens ?? 0)
  const output =
    typeof u.outputTokens === 'number'
      ? u.outputTokens
      : typeof u.outputTokens === 'object'
        ? (u.outputTokens.total ?? u.outputTokens.text ?? 0)
        : (u.completionTokens ?? 0)
  return { inputTokens: input, outputTokens: output }
}

export const runTurn = async (input: RunTurnInput, deps: RunTurnDeps): Promise<RunTurnResult> => {
  const { project: loaded, row } = await loadProject(deps.supabase, input.projectId)
  const turnMode = resolveTurnMode({
    selected: parseTurnMode(input.turnMode ?? loaded.turnMode),
    userMessage: input.userMessage,
  })
  const maxSteps = resolveTurnMaxSteps({
    maxSteps: input.maxSteps,
    userMessage: input.userMessage,
    compositionId: loaded.compositionId,
  })
  const modelProfileId =
    input.modelProfileId ??
    row.model_profile_id ??
    deps.modelProfileId ??
    process.env.MODEL_PROFILE ??
    DEFAULT_MODEL_PROFILE_ID
  const reasonerModelIdOverride = row.reasoner_model_id ?? null
  const videoModelIdOverride = row.video_model_id ?? null
  const assetRefs = resolveAssetReferences(input.userMessage, loaded.assets)
  const grounding = resolveChatGrounding({
    text: input.userMessage,
    clips: loaded.clips,
    overlays: loaded.overlays.map((overlay) => ({
      id: overlay.id,
      kind: overlay.kind,
      text: overlay.text,
    })),
    assets: loaded.assets,
    implicit: input.grounding,
    durationSeconds: loaded.durationFrames / loaded.fps,
  })
  if (grounding.error) {
    throw new Error(grounding.error)
  }

  let disabledOptional: string[] = []
  try {
    const { data: toolSettings, error: toolSettingsError } = await deps.supabase
      .from('products')
      .select('disabled_optional_tools')
      .eq('id', input.productId)
      .maybeSingle()
    if (toolSettingsError) {
      const missingColumn = /disabled_optional_tools|schema cache/i.test(toolSettingsError.message)
      if (!missingColumn) {
        throw new Error(`Could not load agent tool settings: ${toolSettingsError.message}`)
      }
    } else {
      disabledOptional = sanitizeDisabledOptionalTools(
        Array.isArray(toolSettings?.disabled_optional_tools)
          ? toolSettings.disabled_optional_tools.filter(
              (name: unknown): name is string => typeof name === 'string',
            )
          : [],
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Could not load agent tool settings:')) {
      throw error
    }
    disabledOptional = []
  }

  const videoToolEnabled =
    isToolEnabled(modelProfileId, 'generate_video_clip') &&
    !videoGenerateIsDisabled(disabledOptional)

  // Plan confirmed by the operator → this turn must call generate_video_clip (ADR-0086 / ADR-0055).
  const planForce = shouldForceGenerateFromPlan({
    planStatus: loaded.generationPlan?.status,
    videoToolEnabled,
    confirmSpend: input.confirmSpend === true,
  })

  const ctx: StudioToolContext = {
    productId: input.productId,
    projectId: input.projectId,
    project: loaded,
    expectedRevision: loaded.revision,
    supabase: deps.supabase,
    blobEnv: deps.blobEnv,
    modelProfileId,
    persist: deps.persist !== false,
    toolTrace: [],
    confirmSpend: input.confirmSpend === true,
    videoModelId: videoModelIdOverride,
    referencedAssetIds: assetRefs.map((ref) => ref.assetId),
    disabledOptional,
    allowRemoveAuthoredAudio:
      classifyTurnJob({
        userMessage: input.userMessage,
        compositionId: loaded.compositionId,
        sourceChars: loaded.compositionSource?.source?.trim().length ?? 0,
        cutReviewPassed: loaded.cutReview?.passed ?? null,
      }) === 'audio.remove',
    userMessage: input.userMessage,
    // Snapshot the confirmed plan id so generation jobs record it (ADR-0085/0086).
    generationPlanId: planForce ? (loaded.generationPlan?.id ?? undefined) : undefined,
    onToolStart: deps.onToolStart,
    onTool: deps.onTool,
  }

  const [
    installedSkills,
    marketingDocExcerpt,
    brandSummary,
    enabledMcpTools,
    productExtracts,
    listedAnalyses,
  ] = await Promise.all([
    listInstalledPackSkills({
      supabase: deps.supabase,
      blobEnv: deps.blobEnv,
      productId: input.productId,
      userId: input.userId,
    }).catch(() => [] as Awaited<ReturnType<typeof listInstalledPackSkills>>),
    loadProductMarketingExcerpt(input.productId),
    loadBrandKitSummary(input.productId),
    loadEnabledMcpToolsForTurn(deps.supabase, input.productId).catch(
      () => [] as Awaited<ReturnType<typeof loadEnabledMcpToolsForTurn>>,
    ),
    listProductExtracts({
      supabase: deps.supabase,
      productId: input.productId,
      quality: ['usable', 'weak'],
      limit: 40,
    }).catch(() => []),
    listAssetAnalysesForAssets(deps.supabase, {
      productId: input.productId,
      assetIds: ctx.project.assets.map((asset) => asset.id),
    }).catch(() => []),
  ])
  const motionScenePlan = motionScenePlanFromAnalyses({
    analyses: listedAnalyses,
    motionSeed: ctx.project.compositionSource?.motionSeed ?? ctx.project.id,
  })
  const craft = craftFromComposition(loaded.compositionId)
  const motionGraphics = isMotionGraphicsTurn({
    userMessage: input.userMessage,
    compositionId: loaded.compositionId,
    craft,
  })
  const skills = await selectMarketingSkills({
    productId: input.productId,
    userMessage: input.userMessage,
    compositionId: loaded.compositionId,
    craft,
    installed: installedSkills,
  })

  const slideRefs = resolveSlideReferences(input.userMessage, ctx.project.slideshow?.slides ?? [])

  const system = buildSystemPrompt({
    productId: input.productId,
    marketingDocExcerpt,
    brandSummary,
    skills,
    projectSummary: summarizeProject(ctx.project),
    modelProfileId,
    videoModelId: videoModelIdOverride,
    intentScenesSummary: summarizeIntentScenes(
      ctx.project.intent ?? { keywords: [] },
      ctx.project.scenes ?? [],
    ),
    assetReferences: assetReferenceBlock(assetRefs) || undefined,
    slideReferences: slideReferenceBlock(slideRefs) || undefined,
    groundingReferences: groundingReferenceBlock(grounding.payload) || undefined,
    productExtracts: productExtractContextBlock(productExtracts) || undefined,
    motionScenePlan: motionScenePlanContextBlock(motionScenePlan) || undefined,
    turnMode,
    motionGraphics,
    confirmSpend: input.confirmSpend === true,
  })

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: input.userMessage,
    createdAt: new Date().toISOString(),
  }

  const history = [...input.messages, userMessage]
  const { model, reasonerModelId } = await resolveReasoner({
    modelProfileId,
    reasonerModelId: reasonerModelIdOverride,
    userMessage: input.userMessage,
    project: ctx.project,
    override: deps.model,
  })

  // Shared monthly generator cap covers reasoner + image/video (pricing-and-cost.md).
  if (deps.persist !== false && reasonerModelId !== 'mock-reasoner') {
    const budgets = readCreativeBudgets({})
    const spentThisMonthGbp = await sumCostEventsGbp(deps.supabase, {
      productId: input.productId,
      sinceIso: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (spentThisMonthGbp >= budgets.monthlyGeneratorCap) {
      throw new Error(
        `Monthly generator cap (£${budgets.monthlyGeneratorCap}) already reached ` +
          `(£${spentThisMonthGbp.toFixed(2)} spent). Switch Reason to No LLM or raise the cap.`,
      )
    }
  }

  if (
    isMakeVideoRequest(input.userMessage) &&
    videoGenerateIsDisabled(disabledOptional) &&
    turnMode === 'execute'
  ) {
    const assistantText = MAKE_VIDEO_DISABLED_MESSAGE
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString(),
    }
    return {
      messages: [...history, assistantMessage],
      project: ctx.project,
      toolTrace: ctx.toolTrace,
      assistantText,
      skillIds: skills.map((skill) => skill.id),
    }
  }
  const mcpTools = buildMcpToolSet({ tools: enabledMcpTools, ctx })
  const toolMode = planForce ? 'execute' : turnMode
  const sourceChars = ctx.project.compositionSource?.source?.trim().length ?? 0
  const turnJob = classifyTurnJob({
    userMessage: input.userMessage,
    compositionId: ctx.project.compositionId,
    sourceChars,
    cutReviewPassed: ctx.project.cutReview?.passed ?? null,
  })
  const studioTools = omitToolsForTurnMode(
    {
      ...omitDisabledOptionalTools(createStudioTools(ctx), disabledOptional),
      ...(toolMode === 'execute' ? mcpTools : {}),
    },
    toolMode,
  )
  const tools = turnJob === 'extract.pages' ? omitToolsForExtractJob(studioTools) : studioTools

  // planForce = operator confirmed the plan → this turn must call generate_video_clip (ADR-0086).
  // normalForce = plain "make an ad" turn (ADR-0055). Both force generate_video_clip on step 0.
  const normalForce = shouldForceVideoGenerate({
    userMessage: input.userMessage,
    videoToolEnabled,
    remainingBriefSeconds: remainingBriefVideoSeconds(ctx.project),
    compositionId: ctx.project.compositionId,
    turnMode,
  })
  const forceGenerate = planForce || normalForce
  const forceWrite = shouldForceWriteComposition({
    turnMode,
    compositionId: ctx.project.compositionId,
    sourceChars,
    cutReviewPassed: ctx.project.cutReview?.passed ?? null,
    userMessage: input.userMessage,
  })
  const forcePatch =
    !forceWrite &&
    shouldForcePatchComposition({
      turnMode,
      compositionId: ctx.project.compositionId,
      sourceChars,
      userMessage: input.userMessage,
      cutReviewPassed: ctx.project.cutReview?.passed ?? null,
    })
  const musicToolEnabled =
    isToolEnabled(modelProfileId, 'generate_music') && !disabledOptional.includes('generate_music')
  const forceMusic =
    turnJob !== 'extract.pages' &&
    (shouldForceMusicGenerate({
      userMessage: input.userMessage,
      musicToolEnabled,
      hasMusicBed: projectHasMusicBed(ctx.project),
      turnMode,
    }) ||
      (forceWrite &&
        musicToolEnabled &&
        !projectHasMusicBed(ctx.project) &&
        (turnJob === 'picture.write' || turnJob === 'makeAd')))
  const voiceoverToolEnabled =
    isToolEnabled(modelProfileId, 'generate_voiceover') &&
    !disabledOptional.includes('generate_voiceover')
  const forceVoiceover = shouldForceVoiceoverGenerate({
    userMessage: input.userMessage,
    voiceoverToolEnabled,
    hasVoiceover: projectHasVoiceover(ctx.project),
    turnMode,
  })
  const forceExtract = turnModeAllowsGenerate(turnMode) && turnJob === 'extract.pages'
  const forcedFirstTool = forceExtract
    ? 'extract_product_pages'
    : forceWrite
      ? 'write_composition'
      : forcePatch
        ? 'patch_composition'
        : forcedFirstGenerateTool({
            forceVideo: forceGenerate,
            forceMusic,
            forceVoiceover,
          }) || (turnJob === 'audio.voice' ? 'duck_music' : null)

  const result = await generateText({
    model,
    system,
    messages: history
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    tools,
    ...(forcedFirstTool
      ? {
          prepareStep: ({ stepNumber }: { stepNumber: number }) => {
            const choice = forcedToolForStep({
              stepNumber,
              forceWrite,
              forcePatch,
              forceMusic,
              forceVoiceover,
              forcedFirstTool,
              job: turnJob,
            })
            return {
              toolChoice: choice === 'auto' ? ('auto' as const) : choice,
            }
          },
        }
      : {}),
    stopWhen: stepCountIs(maxSteps),
    abortSignal: input.abortSignal,
    onStepStart: async ({ stepNumber }) => {
      await deps.onLive?.({ type: 'step', stepNumber })
    },
    onLanguageModelCallStart: async () => {
      await deps.onLive?.({ type: 'model' })
    },
    onLanguageModelCallEnd: async ({ content }) => {
      for (const toolName of toolNamesFromModelContent(content)) {
        await deps.onLive?.({ type: 'tool_choice', toolName })
      }
    },
    onToolExecutionStart: async (event) => {
      const toolName = event.toolCall.toolName
      if (typeof toolName === 'string' && toolName) {
        await deps.onLive?.({ type: 'tool_start', toolName })
      }
    },
  })

  const tokens = usageTokens(result.usage)
  let reasonerSpend: ReasonerSpend | undefined
  if (reasonerModelId !== 'mock-reasoner') {
    const estimatedGbp = estimateReasonerGbp(reasonerModelId, tokens)
    const spend: ReasonerSpend = {
      role: 'reasoner',
      modelId: reasonerModelId,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimatedGbp,
    }
    if (deps.persist !== false && estimatedGbp > 0) {
      try {
        await recordCostEvent(deps.supabase, {
          productId: input.productId,
          projectId: input.projectId,
          role: 'reasoner',
          modelId: reasonerModelId,
          units: tokens.inputTokens + tokens.outputTokens,
          estimatedGbp,
          actualGbp: estimatedGbp,
        })
        reasonerSpend = spend
      } catch {
        // Do not inflate session £ when the ledger insert failed.
      }
    } else if (estimatedGbp > 0) {
      reasonerSpend = spend
    }
  }

  // ADR-0019: narration for the bubble; receipts ride on message.activity.
  const inspect = [...ctx.toolTrace].reverse().find((entry) => entry.toolName === 'inspect_preview')
  const toolNames = ctx.toolTrace.map((entry) => entry.toolName)
  const calledGenerate = turnCalledGenerateVideo(toolNames)
  const calledMusic = turnCalledGenerateMusic(toolNames)
  const calledVoiceover = turnCalledGenerateVoiceover(toolNames)

  // Drafting the plan is a valid first step (ADR-0086 plan-first flow), so suppress
  // MISSING_GENERATE_MESSAGE for normal force turns that drafted a plan instead of generating.
  // On a confirmed-plan turn (planForce), drafting again is NOT valid — must generate.
  const draftedPlanThisTurn = turnCalledDraftPlan(toolNames)
  const missingGenerate = isMissingGenerate({
    forceGenerate,
    calledGenerate,
    planForce,
    draftedPlanThisTurn,
  })
  const wroteComposition = turnCalledWriteComposition(toolNames)
  const missingWrite = (forceWrite || forcePatch) && !wroteComposition
  const missingExtract = forceExtract && !toolNames.includes('extract_product_pages')

  const assistantText = missingExtract
    ? MISSING_EXTRACT_MESSAGE
    : missingWrite
      ? MISSING_WRITE_COMPOSITION_MESSAGE
      : missingGenerate
        ? MISSING_GENERATE_MESSAGE
        : forceVoiceover && !calledVoiceover
          ? MISSING_VOICEOVER_MESSAGE
          : forceMusic && !calledMusic
            ? MISSING_MUSIC_MESSAGE
            : applyCutReviewNarration({
                userMessage: input.userMessage,
                toolNames,
                project: ctx.project,
                inspectError: inspect && !inspect.outcome.ok ? inspect.outcome.error : undefined,
                turnMode,
                assistantText: groundAssistantText({
                  toolTrace: ctx.toolTrace,
                  modelText: result.text,
                  turnMode,
                }),
              })

  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: assistantText,
    createdAt: new Date().toISOString(),
    ...(ctx.toolTrace.length > 0 ? { activity: [...ctx.toolTrace] } : {}),
  }

  const messages = [...history, assistantMessage]
  return {
    messages,
    project: ctx.project,
    toolTrace: ctx.toolTrace as ToolTraceEntry[],
    assistantText,
    skillIds: skills.map((skill) => skill.id),
    reasonerSpend,
  }
}
