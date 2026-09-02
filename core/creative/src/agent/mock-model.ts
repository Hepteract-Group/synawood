import { MockLanguageModelV3 } from 'ai/test'
import type { StudioProject } from '../project/schema'
import { resolveAssetReferences } from '../project/asset-token'
import { isMakeVideoRequest } from '../critic/inspect-preview'
import { isMotionGraphicsTurn } from './motion-brief'
import { isMusicChangeRequest, isMusicRequest, isVoiceoverRequest } from './force-generate'
import { isExtractRequest } from './turn-job'
import { publicHttpUrlsFromText } from '../extract/urls-from-text'
import { isPlacementRequest, resolvePlacementIntent } from './placement'
import { LEGAL_KIT_FIXTURE } from '../authored/fixtures'

type ToolCallContent = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: string
}

const usage = {
  inputTokens: { total: 12, noCache: 12, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 24, text: 24, reasoning: undefined },
}

const finish = (unified: 'stop' | 'tool-calls') => ({
  unified,
  raw: unified,
})

const toolCall = (
  toolName: string,
  input: Record<string, unknown>,
  id: string,
): ToolCallContent => ({
  type: 'tool-call',
  toolCallId: id,
  toolName,
  input: JSON.stringify(input),
})

const COVER_SCENE_ROLES = ['hook', 'proof', 'cta'] as const
type CoverSceneRole = (typeof COVER_SCENE_ROLES)[number]

const detectCoverSceneRole = (text: string): CoverSceneRole | null => {
  for (const role of COVER_SCENE_ROLES) {
    if (new RegExp(`\\b${role}\\b`).test(text)) return role
  }
  return null
}

const isCoverLibraryRequest = (text: string): boolean =>
  /cover .{0,48}(hook|proof|cta)/.test(text) ||
  (/\bclose-?ups?\b/.test(text) && detectCoverSceneRole(text) !== null)

export const planMockToolCalls = (
  userMessage: string,
  project: StudioProject,
): { toolCalls: ToolCallContent[]; fallbackText: string } => {
  const text = userMessage.toLowerCase()
  const calls: ToolCallContent[] = []
  let n = 1

  // @asset: tokens ground the referenced asset so the mock acts on the right one.
  // Never fall back to assets[0] when the user typed @asset: but resolution missed —
  // that produced "mystery" blank clips from the wrong asset.
  const referenced = resolveAssetReferences(userMessage, project.assets)[0]
  const primaryAsset = referenced
    ? project.assets.find((item) => item.id === referenced.assetId)
    : /@asset:/.test(userMessage)
      ? undefined
      : project.assets[0]

  if (isExtractRequest(userMessage)) {
    calls.push(
      toolCall(
        'extract_product_pages',
        { urls: publicHttpUrlsFromText(userMessage), confirmSpend: true },
        String(n++),
      ),
    )
    return { toolCalls: calls.slice(0, 3), fallbackText: '' }
  }

  if (/summary|status|what.?s on/.test(text)) {
    calls.push(toolCall('get_project_summary', {}, String(n++)))
  }
  if (/caption|subtitle/.test(text)) {
    const captionText =
      userMessage.match(/[“"]([^”"]+)[”"]/)?.[1] ??
      userMessage.match(/captions?:?\s*(.+)$/i)?.[1]?.trim() ??
      'Edit PDFs without the Adobe headache'
    calls.push(
      toolCall('add_captions', { text: captionText, from: 0, durationInFrames: 120 }, String(n++)),
    )
  }
  if (/hook|title card|opening title/.test(text)) {
    const hook =
      userMessage.match(/[“"]([^”"]+)[”"]/)?.[1] ??
      userMessage.match(/hook(?: title)?:?\s*(.+)$/i)?.[1]?.trim() ??
      'Stuck on a PDF again?'
    calls.push(toolCall('set_hook_title', { text: hook }, String(n++)))
  }
  const wantsOnScreenType =
    /\b(text overlay|on-?screen type|lower third)\b/.test(text) ||
    (/\b(add|put|place)\b[\s\S]{0,24}\b(title|headline)\b/.test(text) &&
      !/\b(photo|thumbnail)\b/.test(text)) ||
    /\b(image|still)\b[\s\S]{0,48}\b(of (the )?words?|of text|with the words)\b/.test(text)
  if (wantsOnScreenType) {
    const titleText =
      userMessage.match(/[“"]([^”"]+)[”"]/)?.[1] ??
      userMessage.match(/\bwords?\s+(.+)$/i)?.[1]?.trim() ??
      'Title'
    calls.push(toolCall('add_text', { kind: 'title', text: titleText.slice(0, 240) }, String(n++)))
  }
  if (/end card|cta|demoreader/.test(text) && !wantsOnScreenType) {
    const end =
      userMessage.match(/[“"]([^”"]+)[”"]/)?.[1] ??
      userMessage.match(/end card:?\s*(.+)$/i)?.[1]?.trim() ??
      'example.com'
    calls.push(toolCall('set_end_card', { text: end }, String(n++)))
  }
  if (/trim/.test(text) && project.clips[0]) {
    calls.push(
      toolCall('trim_clip', { clipId: project.clips[0].id, durationInFrames: 90 }, String(n++)),
    )
  }
  const editSeconds = Number(text.match(/(?:at|to)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)/)?.[1])
  if (/split/.test(text) && project.clips[0] && Number.isFinite(editSeconds)) {
    calls.push(
      toolCall(
        'split_clip',
        { clipId: project.clips[0].id, atFrame: Math.round(editSeconds * 30) },
        String(n++),
      ),
    )
  }
  if (/move|place|rearrange/.test(text) && project.clips[0] && Number.isFinite(editSeconds)) {
    calls.push(
      toolCall(
        'place_clip',
        { clipId: project.clips[0].id, from: Math.round(editSeconds * 30) },
        String(n++),
      ),
    )
  }
  if (/ripple delete/.test(text) && project.clips[0]) {
    calls.push(toolCall('ripple_delete_clip', { clipId: project.clips[0].id }, String(n++)))
  } else if (/remove clip|delete clip/.test(text) && project.clips[0]) {
    calls.push(toolCall('remove_clip', { clipId: project.clips[0].id }, String(n++)))
  }
  if (
    /\b(close (the )?gap|merge (the )?(2 |two )?clips|pack (the )?(clips|timeline)|remove (the )?space between)\b/.test(
      text,
    )
  ) {
    calls.push(toolCall('pack_clips', {}, String(n++)))
  }
  if (isPlacementRequest(text) && primaryAsset) {
    const from = resolvePlacementIntent(userMessage, project).from
    calls.push(toolCall('add_clip', { assetId: primaryAsset.id, from }, String(n++)))
  }
  if (/fit (to )?content|fit duration|trim dead air|remove dead air/.test(text)) {
    calls.push(toolCall('fit_duration', {}, String(n++)))
  }
  if (/import product brand|import brand library/.test(text)) {
    calls.push(toolCall('import_product_brand', {}, String(n++)))
  }
  if (
    /model profile|switch profile|cheap-draft|founder-edit|high-fidelity|balanced profile|seedream|gemini|grok-imagine/.test(
      text,
    )
  ) {
    const profileId = /founder-edit/.test(text)
      ? 'founder-edit'
      : /seedream-pro/.test(text)
        ? 'seedream-pro'
        : /seedream-lite|seedream/.test(text)
          ? 'seedream-lite'
          : /gemini-flash/.test(text)
            ? 'gemini-flash-image'
            : /gemini-pro|gemini/.test(text)
              ? 'gemini-pro-image'
              : /grok/.test(text)
                ? 'grok-imagine'
                : /cheap-draft|cheap/.test(text)
                  ? 'cheap-draft'
                  : /high-fidelity|hi-?fi/.test(text)
                    ? 'high-fidelity'
                    : /balanced/.test(text)
                      ? 'balanced'
                      : /ci-stub|stub/.test(text)
                        ? 'ci-stub'
                        : 'founder-edit'
    calls.push(toolCall('set_model_profile', { profileId }, String(n++)))
  }
  if (
    !wantsOnScreenType &&
    (/\b(thumbnail|infographic|still)\b/.test(text) ||
      /\bgenerat\w*\b[\s\S]{0,40}\bimages?\b/.test(text) ||
      /\b(make|create|draw)\b[\s\S]{0,40}\b(an?\s+)?images?\b/.test(text) ||
      /\bstill of\b/.test(text))
  ) {
    if (!project.brand) {
      calls.push(toolCall('import_product_brand', {}, String(n++)))
    }
    const quoted = userMessage.match(/[“"]([^”"]+)[”"]/)?.[1]
    const stripped = userMessage
      .replace(/^(please\s+)?(generate|make|create|draw|add)\s+(and\s+add\s+)?/i, '')
      .replace(/\b(a|an|the)\s+(thumbnail\s+)?image\s+(of\s+)?/i, '')
      .trim()
    const prompt = quoted || stripped || 'Conceptual PDF calm workspace, no fake UI'
    calls.push(toolCall('generate_image', { prompt }, String(n++)))
  }
  if (/voiceover|tts|speak/.test(text)) {
    if (!project.brand) {
      calls.push(toolCall('import_product_brand', {}, String(n++)))
    }
    const line =
      userMessage.match(/[“"]([^”"]+)[”"]/)?.[1] ?? 'Edit PDFs in your browser — no Adobe headache.'
    calls.push(toolCall('generate_voiceover', { text: line }, String(n++)))
  }
  if (/transcribe/.test(text) && primaryAsset) {
    calls.push(toolCall('transcribe_media', { assetId: primaryAsset.id }, String(n++)))
  }
  if (isCoverLibraryRequest(text)) {
    const sceneRole = detectCoverSceneRole(text) ?? 'proof'
    calls.push(toolCall('find_moments', { query: 'close-up', sceneRole }, String(n++)))
    calls.push(toolCall('assemble_broll', { dryRun: true }, String(n++)))
  }
  if (isMusicRequest(userMessage)) {
    const fps = Math.max(1, project.fps)
    const durationSeconds = Math.min(120, Math.max(8, Math.round(project.durationFrames / fps)))
    calls.push(
      toolCall(
        'generate_music',
        {
          prompt: userMessage.slice(0, 800),
          durationSeconds,
          forceInstrumental: true,
          confirmSpend: true,
          placeOnTimeline: true,
        },
        String(n++),
      ),
    )
  }
  if (
    isMotionGraphicsTurn({ userMessage, compositionId: project.compositionId }) &&
    !isVoiceoverRequest(userMessage) &&
    !isMusicRequest(userMessage) &&
    !isMusicChangeRequest(userMessage)
  ) {
    if (project.compositionSource?.compileError) {
      calls.push(
        toolCall(
          'patch_composition',
          { find: "import fs from 'node:fs'\n", replace: '' },
          String(n++),
        ),
      )
    } else {
      if (!project.brand) {
        calls.push(toolCall('import_product_brand', {}, String(n++)))
      }
      if (project.assets.some((asset) => asset.kind === 'image' || asset.kind === 'video')) {
        calls.push(
          toolCall(
            'find_moments',
            { query: userMessage.slice(0, 120) || 'product still' },
            String(n++),
          ),
        )
      }
      calls.push(toolCall('list_motion_kit', {}, String(n++)))
      calls.push(
        toolCall(
          'write_composition',
          {
            source: LEGAL_KIT_FIXTURE,
            artDirection: { dialect: 'editorial', layout: 'split-stat' },
          },
          String(n++),
        ),
      )
    }
  } else if (
    isMakeVideoRequest(userMessage) ||
    /generate (a )?video|video clip|b-?roll/.test(text)
  ) {
    if (!project.brand) {
      calls.push(toolCall('import_product_brand', {}, String(n++)))
    }
    const prompt =
      userMessage.match(/[“"]([^”"]+)[”"]/)?.[1] ?? 'Short branded motion from product still'
    calls.push(
      toolCall(
        'generate_video_clip',
        { prompt, durationSeconds: 4, confirmSpend: true },
        String(n++),
      ),
    )
  }
  if (/export|render|encode/.test(text)) {
    calls.push(toolCall('render_export', {}, String(n++)))
  }
  if (/new project|create project|fresh (cut|project)/.test(text)) {
    calls.push(toolCall('create_project', { compositionId: 'talking-head-60' }, String(n++)))
  }

  if (calls.length === 0) {
    return {
      toolCalls: [toolCall('get_project_summary', {}, '1')],
      fallbackText: '',
    }
  }

  return {
    toolCalls: calls.slice(0, 3),
    fallbackText: '',
  }
}

export const createMockReasoner = (input: { userMessage: string; project: StudioProject }) => {
  let call = 0
  const plan = planMockToolCalls(input.userMessage, input.project)

  return new MockLanguageModelV3({
    provider: 'marketing-os',
    modelId: 'mock-reasoner',
    doGenerate: async () => {
      call += 1
      if (call === 1 && plan.toolCalls.length > 0) {
        return {
          content: plan.toolCalls,
          finishReason: finish('tool-calls'),
          usage,
          warnings: [],
        }
      }
      const names = plan.toolCalls.map((item) => item.toolName).join(', ')
      return {
        content: [
          {
            type: 'text' as const,
            text:
              plan.toolCalls.length > 0
                ? `Done. Ran: ${names}. Preview the Player — export is queued only if you asked for it.`
                : 'Tell me to add captions, set a hook, set an end card, or export.',
          },
        ],
        finishReason: finish('stop'),
        usage,
        warnings: [],
      }
    },
  })
}
