import { createOpenAI } from '@ai-sdk/openai'
import { generateText, type LanguageModel } from 'ai'
import { getModelProfile } from '../model-profiles'
import type { StudioProject } from '../project/schema'
import type { DirectorPlan } from '../intent/schema'
import { formatSpecialistPackForPrompt, specialistPack } from '../agent/skills/specialist'
import {
  buildDirectorPrompt,
  buildHeuristicDirectorPlan,
  directorPlanFromReasonerPayload,
  mergeHeuristicWhenReasonerEmpty,
  parseReasonerDirectorPayload,
  type DirectProjectInput,
} from './plan'

export type BuildDirectorPlanDeps = {
  modelProfileId: string
  /** Test override LanguageModel (non-mock). */
  model?: LanguageModel
}

const resolveDirectorReasoner = async (
  deps: BuildDirectorPlanDeps,
): Promise<{ model: LanguageModel | null; reasonerModelId: string }> => {
  if (deps.model) {
    return { model: deps.model, reasonerModelId: 'test-reasoner' }
  }
  const reasonerModelId = getModelProfile(deps.modelProfileId).reasoner.modelId
  if (reasonerModelId === 'mock-reasoner') {
    return { model: null, reasonerModelId }
  }
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return { model: reasonerModelId as unknown as LanguageModel, reasonerModelId }
  }
  if (process.env.OPENAI_API_KEY?.trim() && reasonerModelId.startsWith('openai/')) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelName = process.env.STUDIO_REASONER_MODEL ?? reasonerModelId.replace(/^openai\//, '')
    return { model: openai(modelName), reasonerModelId }
  }
  return { model: null, reasonerModelId: 'mock-reasoner' }
}

const withVibeWarning = (plan: DirectorPlan, warning: string | undefined): DirectorPlan => {
  if (!warning?.trim()) return plan
  return { ...plan, rationale: `${plan.rationale} ${warning}`.trim() }
}

/**
 * Prefer reasoner JSON when a non-mock model is available; otherwise heuristic.
 * Loads `director-vibes` specialist pack from style (ADR-0031 / #141).
 */
export const buildDirectorPlan = async (
  project: StudioProject,
  input: DirectProjectInput,
  deps: BuildDirectorPlanDeps,
): Promise<{ plan: DirectorPlan; source: 'reasoner' | 'heuristic'; vibeId?: string }> => {
  const planId = crypto.randomUUID()
  const { model, reasonerModelId } = await resolveDirectorReasoner(deps)
  const vibe = await specialistPack('director-vibes', input.style)
  const specialistBlock = vibe ? formatSpecialistPackForPrompt(vibe) : undefined
  // Surface mapping/fallback notes when the founder typed a style (not empty default informative).
  const warning = input.style?.trim() ? vibe?.warning : undefined

  if (!model || reasonerModelId === 'mock-reasoner') {
    const plan = withVibeWarning(
      buildHeuristicDirectorPlan(project, input, {
        id: planId,
        reasonerModelId: reasonerModelId || 'mock-reasoner',
      }),
      warning,
    )
    return { plan, source: 'heuristic', vibeId: vibe?.docId }
  }

  try {
    const result = await generateText({
      model,
      system:
        'You output JSON only for Synawood Director plans. No markdown commentary outside a JSON object. Honour the loaded director-vibes specialist pack.',
      prompt: buildDirectorPrompt(project, input, specialistBlock),
      maxOutputTokens: 1200,
    })
    const payload = parseReasonerDirectorPayload(result.text ?? '')
    if (!payload?.edits?.length) {
      return {
        plan: withVibeWarning(
          buildHeuristicDirectorPlan(project, input, {
            id: planId,
            reasonerModelId,
          }),
          warning,
        ),
        source: 'heuristic',
        vibeId: vibe?.docId,
      }
    }
    const reasonerPlan = directorPlanFromReasonerPayload(project, input, payload, {
      id: planId,
      reasonerModelId,
    })
    const hadProposed = reasonerPlan.edits.some((edit) => edit.status === 'proposed')
    const plan = hadProposed
      ? reasonerPlan
      : mergeHeuristicWhenReasonerEmpty(
          reasonerPlan,
          buildHeuristicDirectorPlan(project, input, {
            id: planId,
            reasonerModelId,
          }),
        )
    return {
      plan: withVibeWarning(plan, warning),
      source: hadProposed ? 'reasoner' : 'heuristic',
      vibeId: vibe?.docId,
    }
  } catch {
    return {
      plan: withVibeWarning(
        buildHeuristicDirectorPlan(project, input, {
          id: planId,
          reasonerModelId,
        }),
        warning,
      ),
      source: 'heuristic',
      vibeId: vibe?.docId,
    }
  }
}
