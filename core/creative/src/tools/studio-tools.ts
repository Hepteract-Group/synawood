import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import {
  addCaptions,
  addSlide,
  applyStudioMutation,
  overlayLayoutSchema,
  overlayStyleSchema,
  createBranchFromActiveTip,
  createProject,
  listBranchSummaries,
  mergeBranchTip,
  planSlideshow,
  promoteBranchToMain,
  removeSlide,
  reorderSlides,
  setDuration,
  setEndCard,
  setHookTitle,
  setSlide,
  setSlideBackground,
  setSlideshowVoiceover,
  setCampaignBrief,
  setCampaignCreative,
  planCampaignCreatives,
  summarizeProject,
  switchActiveBranch,
  evaluatePictureCompleteness,
  findStickerAsset,
  placeSticker,
  slideLayoutIdSchema,
  isAuthoredComposition,
  isSpeechAudioAsset,
  MAIN_VIDEO_TRACK_ID,
  SFX_TRACK_ID,
} from '../project'
import { applyBriefToProject } from '../brief/apply-brief'
import { parseExtractedBrief } from '../brief/extracted-brief'
import { slideshowPresetIdSchema } from '../presets/slideshow'
import { enqueueRenderJob } from '../render'
import { cutReviewRequired, hasFreshCutReview } from '../critic/inspect-preview'
import {
  adPlatformSchema,
  applyPromoteFields,
  planVariantsForParent,
  promoteFieldSchema,
  renderVariantsForParent,
  variantSpecSchema,
} from '../variant'
import { loadProject } from '../project/load'
import { applyProjectMutation, wrapTool } from './store'
import { toolsAcceptingSurplusConfirmSpend } from './accept-surplus-confirm-spend'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'
import { createLocaleTools } from './locale-tools'
import { createLibraryTools } from './library-tools'
import { createStylePackTools } from './style-pack-tools'
import { createPipLayoutTools } from './pip-layout-tools'
import { createStructureTools } from './structure-tools'
import { createVoiceStudioTools } from './voice-tools'
import { createSfxStudioTools } from './sfx-tools'
import { createBrollTools } from './broll-tools'
import { createGenerationPlanTools } from './generation-plan-tools'
import { createCriticTools } from './critic-tools'
import { createCompositionTools } from './composition-tools'
import { runExtractProductPagesTool } from './extract-product-pages-tool'
import { localeCodeSchema } from '../locale/schema'
import {
  runGenerateImageTool,
  runGenerateMusicTool,
  runGenerateVideoClipTool,
  runGenerateVoiceoverTool,
  runImportProductBrandTool,
  runSetModelProfileTool,
  runTranscribeTool,
  runDuckMusicTool,
  runEnhanceSpeechTool,
  runReframeClipTool,
} from './generator-tools'
import { getFirstPartySticker } from '../overlays/stickers'
import { nextUnusedExtractSlideBackground } from '../extract/prefer-extract-refs'
import {
  applyCaptionsFromTranscript,
  readTranscriptWords,
} from '../overlays/captions-from-transcript'
import { setCaptionStyle } from '../overlays/caption-emphasis'
import { putBlob } from '../persistence/blob'
import { estimateGbp } from '../pricing'
import { MODEL_PROFILE_IDS, resolveModelRef } from '../model-profiles'
import { planCampaignForGoal } from '../goals/plan-campaign'
import {
  addSceneOnProject,
  assignClipToSceneOnProject,
  intentAudienceSchema,
  intentEmotionSchema,
  intentFunnelStageSchema,
  intentGoalSchema,
  intentPlatformSchema,
  formatStructuralDiffLines,
  mergeIntent,
  planScenesHeuristic,
  pruneMissingSceneClipRefs,
  removeSceneOnProject,
  reorderScenesOnProject,
  replaceScenesOnProject,
  sceneRoleSchema,
  setIntentOnProject,
  setSceneOnProject,
  structuralDiffLines,
} from '../intent'
import { resolveEndCardText } from '../intent/cta-from-behaviour'
import {
  applyDirectorPlanEdits,
  buildDirectorPlan,
  commitDirectorPlanInContext,
  findDraftDirectorPlanByHash,
  hashDirectProjectInput,
  loadDirectorPlan,
  markPlanStaleIfNeeded,
  saveDirectorPlan,
  saveDirectorPlanAsBranch,
  updateDirectorPlanStatus,
} from '../director'
import { intentSchema } from '../intent/schema'
import { buildClipSuggestions, buildSceneSuggestions } from '../suggest'
import {
  describeAssetIndex,
  findAssetsSemantic,
  findMoments,
  listAssetsByTag,
  loadIndexedShot,
  placeShotOnProject,
  analyzeAsset,
  analyzeKindSchema,
  motionScenePlanFromAnalyses,
} from '../asset-intelligence'
import { runGenerateCampaignCreatives } from '../campaign/generate-creatives'
import { campaignAspectSchema } from '../project/campaign-pack'

export const STUDIO_TOOL_NAMES = [
  'create_project',
  'get_project_summary',
  'set_duration',
  'fit_duration',
  'add_clip',
  'place_clip',
  'pack_clips',
  'trim_clip',
  'split_clip',
  'remove_clip',
  'ripple_delete_clip',
  'place_overlay',
  'remove_overlay',
  'add_captions',
  'captions_from_transcript',
  'set_caption_style',
  'add_text',
  'update_overlay',
  'place_sticker',
  'set_hook_title',
  'set_end_card',
  'set_intent',
  'plan_scenes',
  'apply_scene_plan',
  'add_scene',
  'set_scene',
  'remove_scene',
  'reorder_scenes',
  'assign_clip_to_scene',
  'direct_project',
  'draft_generation_plan',
  'update_generation_plan',
  'commit_director_plan',
  'save_director_plan_as_branch',
  'reject_director_plan',
  'clear_director_rebuild_prompt',
  'suggest_for_clip',
  'suggest_for_scene',
  'render_export',
  'import_product_brand',
  'apply_brief',
  'plan_variants',
  'render_variants',
  'promote_variant_field',
  'list_branches',
  'create_branch',
  'switch_branch',
  'promote_branch',
  'merge_branch',
  'find_assets',
  'find_moments',
  'place_shot',
  'assemble_broll',
  'commit_broll_plan',
  'reject_broll_plan',
  'inspect_preview',
  'list_assets_by_tag',
  'describe_asset',
  'analyze_asset',
  'extract_product_pages',
  'set_model_profile',
  'generate_image',
  'generate_voiceover',
  'generate_music',
  'transcribe_media',
  'enhance_speech',
  'duck_music',
  'reframe_clip',
  'generate_video_clip',
  'plan_slideshow',
  'set_slide',
  'reorder_slides',
  'add_slide',
  'remove_slide',
  'generate_slide_background',
  'set_slideshow_voiceover',
  'set_campaign_brief',
  'plan_campaign_creatives',
  'set_campaign_creative',
  'generate_campaign_creatives',
  'plan_campaign',
  'set_active_locale',
  'translate_all_missing',
  'dub_project_for_locale',
  'apply_locale_money',
  'list_style_packs',
  'set_style_pack',
  'apply_filter',
  'clear_filter',
  'apply_effect',
  'clear_effect',
  'regen_effect',
  'list_library',
  'create_library_item',
  'import_library_item',
  'set_pip_layout',
  'derive_creative_structure',
  'set_creative_structure',
  'synthesize_voice',
  'translate_and_dub',
  'lipsync_clip',
  'remove_fillers',
  'build_cut_list',
  'edit_for_clarity',
  'apply_cut_list',
  'apply_jump_cut_zooms',
  'place_sfx',
  'apply_motion_preset',
  'list_motion_kit',
  'write_composition',
  'patch_composition',
  'set_motion_seed',
] as const

export type StudioToolName = (typeof STUDIO_TOOL_NAMES)[number]

const authoredAudioRemoveBlock = (ctx: StudioToolContext, clipId: string): string | null => {
  if (!isAuthoredComposition(ctx.project.compositionId)) return null
  if (ctx.allowRemoveAuthoredAudio) return null
  const clip = ctx.project.clips.find((row) => row.id === clipId)
  if (!clip) return null
  const asset = ctx.project.assets.find((item) => item.id === clip.assetId)
  if (!asset || asset.kind !== 'audio' || asset.source !== 'generator') return null
  const isMusic = asset.probe?.role === 'music_bed'
  const isSpeech = isSpeechAudioAsset(asset)
  if (!isMusic && !isSpeech) return null
  return (
    'On motion ads, do not remove_clip speech or music to “clean” the timeline — MAIN is empty on purpose. ' +
    'Call generate_voiceover to place speech on track_sfx from frame 0, or ask the operator if they want the audio removed.'
  )
}

export const createStudioTools = (ctx: StudioToolContext): ToolSet =>
  toolsAcceptingSurplusConfirmSpend({
    create_project: tool({
      description:
        'Create a sibling Studio Project. Do not use this for a carousel/slideshow on a Video Suite cut — call plan_slideshow on THIS project so slides appear on this player. Use only when they ask for a fresh cut, or this composition cannot hold slides (Campaign Pack). If you create a sibling, your chat first line MUST be the markdown Open link from the tool result. Never spawn a project silently.',
      inputSchema: z.object({
        compositionId: z
          .enum(['talking-head-60', 'social-carousel', 'vertical-slideshow', 'campaign-pack-still'])
          .optional(),
        durationFrames: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(80).optional(),
        presetId: slideshowPresetIdSchema.optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'create_project', input, async () => {
          const fromProjectId = ctx.projectId
          const created = await createProject(ctx.supabase, {
            productId: ctx.productId,
            compositionId: input.compositionId,
            modelProfileId: ctx.modelProfileId,
            durationFrames: input.durationFrames,
            name: input.name,
            slideshowPresetId: input.presetId,
          })
          ctx.projectId = created.project.id
          ctx.project = created.project
          ctx.expectedRevision = created.project.revision
          const openPath = `/studio/${created.project.id}`
          const label = created.project.name?.trim() || 'the new cut'
          return toolOk(
            `This chat is still on the previous cut. Open [${label}](${openPath}) for the new one. First line of your reply must be that link.`,
            {
              projectId: created.project.id,
              fromProjectId,
              openPath,
              name: label,
              summary: summarizeProject(created.project),
            },
          )
        }),
    }),

    get_project_summary: tool({
      description:
        'Read a compact summary of the current Studio Project (clips, overlays, status).',
      inputSchema: z.object({}),
      execute: async (input) =>
        wrapTool(ctx, 'get_project_summary', input, async () => {
          const summary = summarizeProject(ctx.project)
          return toolOk('Project summary', {
            summary,
            clipIds: ctx.project.clips.map((clip) => clip.id),
            assetIds: ctx.project.assets.map((asset) => asset.id),
            overlays: summary.overlays,
          })
        }),
    }),

    set_duration: tool({
      description:
        'Set the project duration in frames (ADR-0014). Never shrinks below placed clips/overlays. Prefer fit_duration to clear dead air after a short cut.',
      inputSchema: z.object({
        durationFrames: z.number().int().positive(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_duration', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            setDuration(current, input.durationFrames),
          )
          return toolOk(`Set duration to ${project.durationFrames} frames`, {
            durationFrames: project.durationFrames,
            revision: project.revision,
          })
        }),
    }),

    fit_duration: tool({
      description:
        'Snap project duration to the end of the last clip/overlay (+ short tail). Use when the timeline has long empty dead air after a short cut.',
      inputSchema: z.object({}),
      execute: async (input) =>
        wrapTool(ctx, 'fit_duration', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'fit_duration' }),
          )
          return toolOk(`Fitted duration to ${project.durationFrames} frames`, {
            durationFrames: project.durationFrames,
            revision: project.revision,
          })
        }),
    }),

    add_clip: tool({
      description:
        'Place an existing project asset (video or still) on the timeline. Omit trackId to put picture full-frame on the main track. Overlay (`track_broll`) is only used when main already has picture in that window — otherwise the clip is placed on main so the player is not a tiny stamp on black.',
      inputSchema: z.object({
        assetId: z.string().uuid(),
        from: z.number().int().nonnegative().optional(),
        durationInFrames: z.number().int().positive().optional(),
        trimStartFrames: z.number().int().nonnegative().optional(),
        trackId: z.string().min(1).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'add_clip', input, async () => {
          if (isAuthoredComposition(ctx.project.compositionId)) {
            const trackId = input.trackId
            const asset = ctx.project.assets.find((item) => item.id === input.assetId)
            if (isSpeechAudioAsset(asset) && trackId !== SFX_TRACK_ID) {
              return toolFail(
                'On motion ads, place voiceover on track_sfx from frame 0 (speech lane under the music). Call generate_voiceover to re-place an existing take — do not stack it after the bed on track_audio.',
              )
            }
            if (trackId === undefined || trackId === MAIN_VIDEO_TRACK_ID) {
              return toolFail(
                'This is a motion-graphics composition. The Player is the authored TSX, not the timeline. Call patch_composition or write_composition — do not add_clip stills or clips onto MAIN.',
              )
            }
          }
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'add_clip', ...input, from: input.from ?? 0 }),
          )
          const clip = project.clips.at(-1)
          const completeness = evaluatePictureCompleteness(project)
          const gapNote = completeness.ok
            ? ''
            : ` Picture completeness: ${completeness.failures.map((row) => row.message).join(' ')}`
          return toolOk(`Added clip ${clip?.id ?? ''} (asset ${input.assetId}).${gapNote}`, {
            clipId: clip?.id,
            assetId: input.assetId,
            from: clip?.from ?? input.from ?? 0,
            revision: project.revision,
            pictureCompletenessOk: completeness.ok,
          })
        }),
    }),

    place_clip: tool({
      description:
        'Move an existing clip to a new timeline frame. Prefer pack_clips when the user wants to close a gap / merge abutting clips — do not guess frames for that.',
      inputSchema: z.object({
        clipId: z.string().min(1),
        from: z.number().int().nonnegative(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'place_clip', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'place_clip', ...input }),
          )
          return toolOk(`Moved clip ${input.clipId} to frame ${input.from}`, {
            revision: project.revision,
          })
        }),
    }),

    pack_clips: tool({
      description:
        'Close gaps BETWEEN clips on the video track by packing them end-to-end. Use for "pack the timeline", "close the gap", "merge the clips", "remove the space between clips". Omit trackId. Do NOT use fit_duration or place_clip for this — fit_duration only shortens trailing empty tail after the last content.',
      inputSchema: z.object({
        trackId: z.string().min(1).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'pack_clips', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'pack_clips', trackId: input.trackId }),
          )
          return toolOk(`Packed clips; duration now ${project.durationFrames} frames`, {
            durationFrames: project.durationFrames,
            clips: project.clips.map((clip) => ({
              id: clip.id,
              from: clip.from,
              durationInFrames: clip.durationInFrames,
            })),
            revision: project.revision,
          })
        }),
    }),

    trim_clip: tool({
      description: 'Trim an existing clip duration / in-point.',
      inputSchema: z.object({
        clipId: z.string().min(1),
        from: z.number().int().nonnegative().optional(),
        durationInFrames: z.number().int().positive(),
        trimStartFrames: z.number().int().nonnegative().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'trim_clip', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'trim_clip', ...input }),
          )
          return toolOk(`Trimmed clip ${input.clipId}`, { revision: project.revision })
        }),
    }),

    split_clip: tool({
      description: 'Split an existing clip at an absolute timeline frame.',
      inputSchema: z.object({
        clipId: z.string().min(1),
        atFrame: z.number().int().nonnegative(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'split_clip', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'split_clip', ...input }),
          )
          return toolOk(`Split clip ${input.clipId} at frame ${input.atFrame}`, {
            revision: project.revision,
          })
        }),
    }),

    remove_clip: tool({
      description:
        'Remove a clip by id from the timeline. Use this when the operator asks to delete or take off music, voiceover, or any clip. Do not use it unsolicited to “clean” an authored motion ad (empty MAIN is expected).',
      inputSchema: z.object({
        clipId: z.string().min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'remove_clip', input, async () => {
          const blocked = authoredAudioRemoveBlock(ctx, input.clipId)
          if (blocked) return toolFail(blocked)
          const { project } = await applyProjectMutation(ctx, (current) =>
            pruneMissingSceneClipRefs(
              applyStudioMutation(current, { type: 'remove_clip', ...input }),
            ),
          )
          return toolOk(`Removed clip ${input.clipId}`, { revision: project.revision })
        }),
    }),

    ripple_delete_clip: tool({
      description: 'Remove a clip and close the gap on its track.',
      inputSchema: z.object({
        clipId: z.string().min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'ripple_delete_clip', input, async () => {
          const blocked = authoredAudioRemoveBlock(ctx, input.clipId)
          if (blocked) return toolFail(blocked)
          const { project } = await applyProjectMutation(ctx, (current) =>
            pruneMissingSceneClipRefs(
              applyStudioMutation(current, { type: 'ripple_delete_clip', ...input }),
            ),
          )
          return toolOk(`Ripple deleted clip ${input.clipId}`, { revision: project.revision })
        }),
    }),

    place_overlay: tool({
      description:
        'Move or resize an existing overlay (caption, hook title, end card) on the timeline.',
      inputSchema: z.object({
        overlayId: z.string().min(1),
        from: z.number().int().nonnegative(),
        durationInFrames: z.number().int().positive().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'place_overlay', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'place_overlay', ...input }),
          )
          return toolOk(
            input.durationInFrames != null
              ? `Resized overlay ${input.overlayId} to ${input.durationInFrames}f at frame ${input.from}`
              : `Moved overlay ${input.overlayId} to frame ${input.from}`,
            {
              revision: project.revision,
            },
          )
        }),
    }),

    remove_overlay: tool({
      description: 'Remove an overlay by id from the timeline.',
      inputSchema: z.object({
        overlayId: z.string().min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'remove_overlay', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'remove_overlay', ...input }),
          )
          return toolOk(`Removed overlay ${input.overlayId}`, { revision: project.revision })
        }),
    }),

    add_captions: tool({
      description: 'Add caption text as an on-timeline overlay (not a render).',
      inputSchema: z.object({
        text: z.string().min(1),
        from: z.number().int().nonnegative().optional(),
        durationInFrames: z.number().int().positive().optional(),
        style: overlayStyleSchema.optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'add_captions', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            addCaptions(current, input),
          )
          const caption = project.overlays.filter((overlay) => overlay.kind === 'caption').at(-1)
          const karaokeWithoutWords = input.style?.presetId === 'karaoke'
          return toolOk(
            karaokeWithoutWords
              ? 'Added captions as band — karaoke needs word timings (use captions_from_transcript).'
              : 'Added captions',
            {
              overlayId: caption?.id,
              text: caption?.text,
              revision: project.revision,
            },
          )
        }),
    }),

    captions_from_transcript: tool({
      description:
        'Build karaoke caption overlays from a clip’s word timings (active word pops). Falls back to the band preset if timings are missing. If the clip has no transcript, this transcribes first — pass confirmSpend=true when the estimate is > £0. Never spend silently.',
      inputSchema: z.object({
        clipId: z.string().min(1),
        confirmSpend: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'captions_from_transcript', input, async () => {
          const clip = ctx.project.clips.find((item) => item.id === input.clipId)
          if (!clip) return toolFail(`Unknown clip ${input.clipId}`)
          let words = readTranscriptWords(ctx.project, input.clipId)
          if (words.length === 0) {
            const model = resolveModelRef(ctx.modelProfileId, 'transcribe')
            const estimatedGbp = estimateGbp(model.modelId, 30)
            const confirmed = Boolean(input.confirmSpend || ctx.confirmSpend)
            if (estimatedGbp > 0 && !confirmed) {
              return toolFail(
                `This clip has no transcript. Transcribe would cost about £${estimatedGbp.toFixed(2)} — pass confirmSpend=true to continue.`,
              )
            }
            const transcribed = await runTranscribeTool(ctx, {
              assetId: clip.assetId,
              confirmSpend: true,
            })
            if (!transcribed.ok) return transcribed
            const segments = transcribed.data?.segments as
              Array<{ startMs?: number; endMs?: number; text?: string }> | undefined
            words = Array.isArray(segments)
              ? segments.map((row) => ({
                  startMs: Number(row.startMs) || 0,
                  endMs: Number(row.endMs) || 0,
                  text: String(row.text ?? ''),
                }))
              : []
            if (words.length === 0) {
              return toolFail('Transcription returned no word timings to caption.')
            }
          }
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyCaptionsFromTranscript(current, words),
          )
          const captions = project.overlays.filter((overlay) => overlay.kind === 'caption')
          return toolOk(`Added ${captions.length} caption overlay(s) from transcript (karaoke).`, {
            count: captions.length,
            presetId: 'karaoke',
            revision: project.revision,
          })
        }),
    }),

    set_caption_style: tool({
      description:
        'Set karaoke on/off, keyword color, or licensed marks on caption overlays. Pass emoji:false to clear marks, highlight:false to clear keyword color. Operator can also clear these in the inspector. No spend.',
      inputSchema: z.object({
        overlayId: z.string().min(1).optional(),
        karaoke: z.boolean().optional(),
        highlight: z.boolean().optional(),
        emoji: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_caption_style', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            setCaptionStyle(current, input),
          )
          return toolOk(
            input.emoji === false
              ? 'Cleared caption marks.'
              : input.highlight === false
                ? 'Cleared caption highlights.'
                : input.emoji === true
                  ? 'Updated caption marks.'
                  : 'Updated caption highlights.',
            { revision: project.revision },
          )
        }),
    }),

    add_text: tool({
      description:
        'Place a text overlay on the overlay lane (title, hook, lower third, or end card). Use this for on-screen type — never generate_image of words.',
      inputSchema: z.object({
        text: z.string().min(1).max(240),
        kind: z.enum(['title', 'hook_title', 'end_card', 'lower_third']).optional(),
        from: z.number().int().nonnegative().optional(),
        durationInFrames: z.number().int().positive().optional(),
        layout: overlayLayoutSchema.optional(),
        style: overlayStyleSchema.optional(),
        libraryItemId: z.string().min(1).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'add_text', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'add_text', ...input }),
          )
          const kind = input.kind ?? 'title'
          const overlay = project.overlays.filter((item) => item.kind === kind).at(-1)
          return toolOk(`Added ${kind} "${input.text}"`, {
            overlayId: overlay?.id,
            kind: overlay?.kind,
            revision: project.revision,
          })
        }),
    }),

    update_overlay: tool({
      description:
        'Patch copy, timing, layout, or style on an existing overlay (including captions).',
      inputSchema: z.object({
        overlayId: z.string().min(1),
        text: z.string().min(1).max(400).optional(),
        from: z.number().int().nonnegative().optional(),
        durationInFrames: z.number().int().positive().optional(),
        layout: overlayLayoutSchema.optional(),
        style: overlayStyleSchema.nullable().optional(),
        libraryItemId: z.string().min(1).nullable().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'update_overlay', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            applyStudioMutation(current, { type: 'update_overlay', ...input }),
          )
          const overlay = project.overlays.find((item) => item.id === input.overlayId)
          return toolOk(`Updated overlay ${input.overlayId}`, {
            overlayId: overlay?.id,
            kind: overlay?.kind,
            revision: project.revision,
          })
        }),
    }),

    place_sticker: tool({
      description:
        'Place a first-party sticker (arrow, circle, check, New) on the overlay lane. Copies the pack graphic into project assets. Never add_clip a sticker onto MAIN.',
      inputSchema: z.object({
        stickerId: z.string().min(1),
        from: z.number().int().nonnegative().optional(),
        durationInFrames: z.number().int().positive().optional(),
        layout: overlayLayoutSchema.optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'place_sticker', input, async () => {
          const sticker = getFirstPartySticker(input.stickerId)
          if (!sticker) {
            return toolFail(
              `Unknown first-party sticker: ${input.stickerId}. Pick one from the Stickers tab.`,
            )
          }
          let blobKey: string | undefined
          if (!findStickerAsset(ctx.project, sticker.id)) {
            if (ctx.persist) {
              const put = await putBlob({
                blobEnv: ctx.blobEnv,
                productId: ctx.productId,
                kind: 'uploads',
                parts: [ctx.projectId, `sticker-${sticker.id}.svg`],
                data: sticker.svg,
                contentType: 'image/svg+xml',
              })
              blobKey = put.blobKey
            } else {
              blobKey = `local/marketing-os/${ctx.productId}/stickers/${sticker.id}.svg`
            }
          }
          const { project } = await applyProjectMutation(ctx, (current) =>
            placeSticker(current, {
              stickerId: sticker.id,
              blobKey,
              from: input.from,
              durationInFrames: input.durationInFrames,
              layout: input.layout,
            }),
          )
          const overlay = project.overlays.filter((item) => item.kind === 'sticker').at(-1)
          return toolOk(`Placed ${sticker.label} sticker`, {
            overlayId: overlay?.id,
            assetId: overlay?.assetId,
            stickerId: sticker.id,
            revision: project.revision,
          })
        }),
    }),

    set_hook_title: tool({
      description: 'Set or replace the opening hook title card (first ~3 seconds).',
      inputSchema: z.object({
        text: z.string().min(1).max(120),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_hook_title', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            setHookTitle(current, input.text),
          )
          return toolOk(`Set hook title to "${input.text}"`, { revision: project.revision })
        }),
    }),

    set_end_card: tool({
      description:
        'Set or replace the end card CTA / URL text. Omit text to use Intent.cta, then brand.defaultCta.',
      inputSchema: z.object({
        text: z.string().min(1).max(160).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_end_card', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) => {
            const text = resolveEndCardText(current, input.text)
            return setEndCard(current, text)
          })
          const card = project.overlays.find((overlay) => overlay.kind === 'end_card')
          return toolOk(`Set end card to "${card?.text ?? ''}"`, { revision: project.revision })
        }),
    }),

    set_intent: tool({
      description:
        'Merge a partial Intent patch onto the project (goal, funnel stage, KPI, desired behaviour, audience including awareness stage / language / primary pain, primary message, supporting points ≤2, platform, emotion, length, CTA, brand voice, keywords). Does not rebuild the timeline — propose direct_project after structural changes.',
      inputSchema: z.object({
        goal: intentGoalSchema.optional(),
        goalNote: z.string().min(1).max(240).optional(),
        funnelStage: intentFunnelStageSchema.optional(),
        kpi: z.string().min(1).max(80).optional(),
        desiredBehaviour: z.string().min(1).max(160).optional(),
        audience: intentAudienceSchema.optional(),
        platform: intentPlatformSchema.optional(),
        emotion: intentEmotionSchema.optional(),
        lengthSeconds: z.number().positive().max(600).optional(),
        cta: z.string().min(1).max(120).optional(),
        primaryMessage: z.string().min(1).max(160).optional(),
        supportingPoints: z.array(z.string().min(1).max(160)).max(2).optional(),
        brandVoice: z.string().min(1).max(120).optional(),
        keywords: z.array(z.string().min(1).max(40)).max(24).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_intent', input, async () => {
          const before = ctx.project.intent ?? { keywords: [] }
          const merged = mergeIntent(before, input)
          if (JSON.stringify(merged) === JSON.stringify(before)) {
            return toolOk('Intent unchanged', {
              intent: before,
              revision: ctx.project.revision,
            })
          }
          const { project } = await applyProjectMutation(ctx, (current) => {
            const beforeIntent = current.intent ?? { keywords: [] }
            const next = setIntentOnProject(current, input)
            const diffs = structuralDiffLines(beforeIntent, next.intent ?? { keywords: [] })
            if (diffs.length === 0) {
              return { ...next, directorRebuildPrompt: current.directorRebuildPrompt ?? null }
            }
            return {
              ...next,
              directorRebuildPrompt: {
                diffs: formatStructuralDiffLines(diffs),
                atRevision: next.revision,
              },
            }
          })
          return toolOk('Updated project intent', {
            intent: project.intent,
            revision: project.revision,
            directorRebuildPrompt: project.directorRebuildPrompt ?? null,
          })
        }),
    }),

    plan_scenes: tool({
      description:
        'Draft a ScenePlan (hook/problem/solution/cta) from Intent + timeline clips. Deterministic heuristic for now — does not write scenes unless you call apply_scene_plan with the returned scenes.',
      inputSchema: z.object({
        preserveClipOrder: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'plan_scenes', input, async () => {
          const plan = planScenesHeuristic(ctx.project, {
            preserveClipOrder: input.preserveClipOrder,
          })
          return toolOk(plan.rationale, {
            scenes: plan.scenes,
            preserveClipOrder: plan.preserveClipOrder,
            commit: false,
          })
        }),
    }),

    apply_scene_plan: tool({
      description:
        'Replace project.scenes with a ScenePlan (usually from plan_scenes). Validates clip references and one-scene-per-clip.',
      inputSchema: z.object({
        scenes: z.array(z.record(z.string(), z.unknown())).min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'apply_scene_plan', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            replaceScenesOnProject(current, input.scenes),
          )
          return toolOk(`Applied ${project.scenes.length} scene(s)`, {
            scenes: project.scenes,
            revision: project.revision,
          })
        }),
    }),

    add_scene: tool({
      description: 'Append (or insert) a Scene on the project story tree.',
      inputSchema: z.object({
        role: sceneRoleSchema,
        label: z.string().min(1).max(160),
        intentNote: z.string().min(1).max(400).optional(),
        targetDurationFrames: z.number().int().positive().optional(),
        clipIds: z.array(z.string().min(1)).optional(),
        overlayIds: z.array(z.string().min(1)).optional(),
        locked: z.boolean().optional(),
        index: z.number().int().nonnegative().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'add_scene', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            addSceneOnProject(current, input),
          )
          const scene = project.scenes[input.index ?? project.scenes.length - 1]
          return toolOk(`Added scene ${scene?.id ?? ''}`, {
            scene,
            revision: project.revision,
          })
        }),
    }),

    set_scene: tool({
      description: 'Update one Scene (label, role, note, target duration, locked).',
      inputSchema: z.object({
        sceneId: z.string().min(1),
        role: sceneRoleSchema.optional(),
        label: z.string().min(1).max(160).optional(),
        intentNote: z.string().min(1).max(400).nullable().optional(),
        targetDurationFrames: z.number().int().positive().nullable().optional(),
        locked: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_scene', input, async () => {
          const before = ctx.project.scenes.find((item) => item.id === input.sceneId)
          if (!before) {
            throw new Error(`Unknown scene ${input.sceneId}`)
          }
          const preview = setSceneOnProject(ctx.project, input)
          const after = preview.scenes.find((item) => item.id === input.sceneId)
          if (JSON.stringify(before) === JSON.stringify(after)) {
            return toolOk(`Scene ${input.sceneId} already up to date`, {
              scene: before,
              revision: ctx.project.revision,
            })
          }
          const { project } = await applyProjectMutation(ctx, (current) =>
            setSceneOnProject(current, input),
          )
          const scene = project.scenes.find((item) => item.id === input.sceneId)
          return toolOk(`Updated scene ${input.sceneId}`, {
            scene,
            revision: project.revision,
          })
        }),
    }),

    remove_scene: tool({
      description: 'Remove a Scene from the story tree (clips stay on the timeline).',
      inputSchema: z.object({
        sceneId: z.string().min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'remove_scene', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            removeSceneOnProject(current, input.sceneId),
          )
          return toolOk(`Removed scene ${input.sceneId}`, {
            sceneCount: project.scenes.length,
            revision: project.revision,
          })
        }),
    }),

    reorder_scenes: tool({
      description: 'Reorder project.scenes by providing every scene id exactly once.',
      inputSchema: z.object({
        sceneIds: z.array(z.string().min(1)).min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'reorder_scenes', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            reorderScenesOnProject(current, input.sceneIds),
          )
          return toolOk('Reordered scenes', {
            sceneIds: project.scenes.map((scene) => scene.id),
            revision: project.revision,
          })
        }),
    }),

    assign_clip_to_scene: tool({
      description:
        'Assign a timeline clip to a scene (or pass sceneId null to unassign). A clip belongs to at most one scene.',
      inputSchema: z.object({
        clipId: z.string().min(1),
        sceneId: z.string().min(1).nullable(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'assign_clip_to_scene', input, async () => {
          const owner = ctx.project.scenes.find((scene) => scene.clipIds.includes(input.clipId))
          if (input.sceneId === null && !owner) {
            return toolOk(`Clip ${input.clipId} is already unassigned`, {
              scenes: ctx.project.scenes,
              revision: ctx.project.revision,
            })
          }
          if (input.sceneId !== null && owner?.id === input.sceneId) {
            return toolOk(`Clip ${input.clipId} is already on that scene`, {
              scenes: ctx.project.scenes,
              revision: ctx.project.revision,
            })
          }
          const { project } = await applyProjectMutation(ctx, (current) =>
            assignClipToSceneOnProject(current, input),
          )
          return toolOk(
            input.sceneId
              ? `Assigned clip ${input.clipId} to scene ${input.sceneId}`
              : `Unassigned clip ${input.clipId} from scenes`,
            { scenes: project.scenes, revision: project.revision },
          )
        }),
    }),

    direct_project: tool({
      description:
        'AI Director: draft a preview-first DirectorPlan (mutations + rationale + cost). dryRun defaults true and NEVER mutates the timeline — call commit_director_plan to apply. Prefer this for cross-cutting vibe/intent rebuilds.',
      inputSchema: z.object({
        style: z.string().min(1).max(80).optional(),
        intentOverrides: intentSchema.partial().optional(),
        scope: z
          .union([
            z.literal('global'),
            z.object({ sceneIds: z.array(z.string().min(1)).min(1) }).strict(),
            z.object({ clipIds: z.array(z.string().min(1)).min(1) }).strict(),
          ])
          .optional(),
        dryRun: z.boolean().optional(),
        maxCostGbp: z.number().nonnegative().optional(),
        refinement: z
          .object({
            priorPlanId: z.string().uuid(),
            note: z.string().min(1).max(400),
          })
          .strict()
          .optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'direct_project', input, async () => {
          const dryRun = input.dryRun !== false
          const directInput = {
            style: input.style,
            intentOverrides: input.intentOverrides,
            scope: input.scope ?? 'global',
            dryRun,
            maxCostGbp: input.maxCostGbp,
            refinement: input.refinement,
          }
          const inputHash = hashDirectProjectInput(
            ctx.project.id,
            ctx.project.revision,
            directInput,
          )

          if (ctx.persist) {
            const cached = await findDraftDirectorPlanByHash(ctx.supabase, {
              projectId: ctx.project.id,
              projectRevision: ctx.project.revision,
              inputHash,
            })
            if (cached) {
              return toolOk('Reused cached Director plan (same revision + inputs)', {
                plan: cached.plan,
                source: 'cache',
                dryRun,
                mutated: false,
              })
            }
          } else if (
            ctx.project.directorPlan?.status === 'draft' &&
            ctx.project.directorPlan.projectRevision === ctx.project.revision
          ) {
            // In-memory tests: one draft mirror at a time is enough for cherry-pick flows.
          }

          const { plan, source, vibeId } = await buildDirectorPlan(ctx.project, directInput, {
            modelProfileId: ctx.modelProfileId,
          })

          if (ctx.persist) {
            await saveDirectorPlan(ctx.supabase, {
              productId: ctx.productId,
              projectId: ctx.project.id,
              inputHash,
              plan,
            })
          }

          // Mirror on project JSON for reload UX / tests (does not count as timeline mutate).
          ctx.project = { ...ctx.project, directorPlan: plan }

          if (!dryRun) {
            const { appliedIds } = applyDirectorPlanEdits(ctx.project, plan)
            if (appliedIds.length === 0) {
              return toolOk('Director dryRun=false but no proposed edits to apply', {
                plan,
                source,
                vibeId,
                dryRun: false,
                mutated: false,
              })
            }
            const { project: saved } = await applyProjectMutation(ctx, (current) => {
              const result = applyDirectorPlanEdits(current, plan)
              return result.project
            })
            const appliedPlan = {
              ...plan,
              status: 'applied' as const,
              projectRevision: saved.revision,
            }
            if (ctx.persist) {
              await updateDirectorPlanStatus(ctx.supabase, {
                planId: plan.id,
                plan: appliedPlan,
              })
            }
            ctx.project = { ...saved, directorPlan: appliedPlan }
            return toolOk(`Director applied ${appliedIds.length} edit(s)`, {
              plan: appliedPlan,
              source,
              vibeId,
              dryRun: false,
              mutated: true,
              appliedIds,
            })
          }

          return toolOk(
            `Director drafted ${plan.edits.filter((e) => e.status === 'proposed').length} edit(s) (${source}). Preview then commit_director_plan.`,
            {
              plan,
              source,
              vibeId,
              dryRun: true,
              mutated: false,
            },
          )
        }),
    }),

    commit_director_plan: tool({
      description:
        'Apply a previously drafted DirectorPlan atomically. Pass excludeMutationIds to cherry-pick. Fails if the plan is stale vs current project revision. To also fork a named branch after commit, use save_director_plan_as_branch.',
      inputSchema: z.object({
        planId: z.string().uuid(),
        excludeMutationIds: z.array(z.string().min(1)).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'commit_director_plan', input, async () => {
          const result = await commitDirectorPlanInContext(ctx, input)
          if (!result.ok) return toolFail(result.error)
          return toolOk(`Committed Director plan (${result.appliedIds.length} edit(s))`, {
            plan: result.plan,
            appliedIds: result.appliedIds,
            revision: result.revision,
          })
        }),
    }),

    save_director_plan_as_branch: tool({
      description:
        'Commit a draft DirectorPlan onto the active tip, then fork that post-commit tip into a new named branch (Funny / Luxury / …). Does not replace main. Optional switchAfter. Prefer over commit_director_plan + create_branch when the founder wants a style branch after Director.',
      inputSchema: z.object({
        planId: z.string().uuid(),
        branchName: z.string().trim().min(1).max(40),
        excludeMutationIds: z.array(z.string().min(1)).optional(),
        switchAfter: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'save_director_plan_as_branch', input, async () => {
          const result = await saveDirectorPlanAsBranch(ctx, input)
          if (!result.ok) return toolFail(result.error)
          return toolOk(
            `Committed Director plan and saved as branch ${result.branch.name}${result.switched ? ' (switched)' : ''}`,
            {
              plan: result.plan,
              appliedIds: result.appliedIds,
              revision: result.revision,
              branchId: result.branch.id,
              slug: result.branch.slug,
              switched: result.switched,
            },
          )
        }),
    }),

    reject_director_plan: tool({
      description:
        'Reject a draft/stale DirectorPlan without applying. Persists status=rejected and clears the project mirror so reload does not resurrect the pill.',
      inputSchema: z.object({
        planId: z.string().uuid(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'reject_director_plan', input, async () => {
          let plan = ctx.project.directorPlan
          if (!plan || plan.id !== input.planId) {
            if (!ctx.persist) {
              return toolFail(`Director plan ${input.planId} not found on project`)
            }
            const loaded = await loadDirectorPlan(ctx.supabase, input.planId)
            if (!loaded) return toolFail(`Director plan ${input.planId} not found`)
            plan = loaded.plan
          }
          if (plan.status !== 'draft' && plan.status !== 'stale') {
            return toolFail(
              `Director plan status is ${plan.status}; only draft or stale plans can be rejected`,
            )
          }
          const rejectedPlan = {
            ...plan,
            status: 'rejected' as const,
            projectRevision: ctx.project.revision,
          }
          if (ctx.persist) {
            await updateDirectorPlanStatus(ctx.supabase, {
              planId: plan.id,
              plan: rejectedPlan,
            })
          }
          const { project } = await applyProjectMutation(ctx, (current) => ({
            ...current,
            directorPlan: undefined,
            directorRebuildPrompt: null,
            revision: current.revision + 1,
          }))
          ctx.project = { ...project, directorPlan: undefined }
          return toolOk('Rejected Director plan', {
            plan: rejectedPlan,
            revision: project.revision,
          })
        }),
    }),

    clear_director_rebuild_prompt: tool({
      description:
        'Dismiss the Intent-changed Director rebuild banner without applying a plan (founder Dismiss / after successful Preview). Optional rebindPlanId re-stamps a draft plan to the new revision so clearing does not mark it stale.',
      inputSchema: z.object({
        rebindPlanId: z.string().uuid().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'clear_director_rebuild_prompt', input, async () => {
          if (!ctx.project.directorRebuildPrompt && !input.rebindPlanId) {
            return toolOk('No rebuild prompt to clear', {
              revision: ctx.project.revision,
              directorRebuildPrompt: null,
            })
          }
          let project = ctx.project
          if (ctx.project.directorRebuildPrompt) {
            const saved = await applyProjectMutation(ctx, (current) => ({
              ...current,
              directorRebuildPrompt: null,
              revision: current.revision + 1,
            }))
            project = saved.project
          }

          let reboundPlan: Awaited<ReturnType<typeof updateDirectorPlanStatus>> | null = null
          if (input.rebindPlanId && ctx.persist) {
            const loaded = await loadDirectorPlan(ctx.supabase, input.rebindPlanId)
            if (loaded && (loaded.plan.status === 'draft' || loaded.plan.status === 'stale')) {
              const nextPlan = {
                ...loaded.plan,
                status: 'draft' as const,
                projectRevision: project.revision,
              }
              reboundPlan = await updateDirectorPlanStatus(ctx.supabase, {
                planId: loaded.plan.id,
                plan: nextPlan,
              })
              ctx.project = { ...project, directorPlan: nextPlan }
              project = ctx.project
            }
          }

          return toolOk('Cleared Director rebuild prompt', {
            revision: project.revision,
            directorRebuildPrompt: null,
            plan: reboundPlan,
          })
        }),
    }),

    suggest_for_clip: tool({
      description:
        'List executable contextual suggestions for one clip (heuristic + optional reasoner). Does not mutate; Apply by calling the suggested tool with args.',
      inputSchema: z.object({
        clipId: z.string().min(1),
        max: z.number().int().positive().max(12).optional(),
        refresh: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'suggest_for_clip', input, async () => {
          if (!ctx.project.clips.some((clip) => clip.id === input.clipId)) {
            return toolFail(`Unknown clip ${input.clipId}`)
          }
          const { suggestions, sources } = await buildClipSuggestions(ctx.project, input.clipId, {
            max: input.max,
            modelProfileId: ctx.modelProfileId,
            refresh: input.refresh,
          })
          return toolOk(`${suggestions.length} suggestion(s) for clip`, {
            suggestions,
            sources,
            projectRevision: ctx.project.revision,
          })
        }),
    }),

    suggest_for_scene: tool({
      description:
        'List executable contextual suggestions for one scene (heuristic + optional reasoner). Does not mutate.',
      inputSchema: z.object({
        sceneId: z.string().min(1),
        max: z.number().int().positive().max(12).optional(),
        refresh: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'suggest_for_scene', input, async () => {
          if (!ctx.project.scenes.some((scene) => scene.id === input.sceneId)) {
            return toolFail(`Unknown scene ${input.sceneId}`)
          }
          const { suggestions, sources } = await buildSceneSuggestions(ctx.project, input.sceneId, {
            max: input.max,
            modelProfileId: ctx.modelProfileId,
            refresh: input.refresh,
          })
          return toolOk(`${suggestions.length} suggestion(s) for scene`, {
            suggestions,
            sources,
            projectRevision: ctx.project.revision,
          })
        }),
    }),

    apply_brief: tool({
      description:
        'Apply an ExtractedBrief onto this project: seed project.brand from brandCandidates, mirror brief, and set hook/CTA overlays (minimal first cut). Pass the brief JSON from extract. Director mode falls back to minimal until Wave 2A (#139).',
      inputSchema: z.object({
        brief: z.record(z.string(), z.unknown()),
        firstCutMode: z.enum(['minimal', 'director']).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'apply_brief', input, async () => {
          let brief
          try {
            brief = parseExtractedBrief(input.brief)
          } catch (error) {
            return toolFail(error instanceof Error ? error.message : 'Invalid ExtractedBrief')
          }
          let modeUsed: 'minimal' | 'director' = 'minimal'
          let warning: string | undefined
          let hookText: string | undefined
          let endCardText: string | undefined
          const { project } = await applyProjectMutation(
            ctx,
            (current) => {
              const applied = applyBriefToProject({
                project: current,
                brief,
                firstCutMode: input.firstCutMode,
              })
              modeUsed = applied.modeUsed
              warning = applied.warning
              hookText = applied.hookText
              endCardText = applied.endCardText
              return applied.project
            },
            'apply_brief',
          )
          return toolOk(
            warning
              ? `Applied brief (${modeUsed}): ${warning}`
              : `Applied brief (${modeUsed}): brand + hook/CTA overlays`,
            {
              revision: project.revision,
              modeUsed,
              warning,
              hookText,
              endCardText,
              brandDisplayName: project.brand?.displayName,
            },
          )
        }),
    }),

    plan_variants: tool({
      description:
        'Plan a platform × hook × CTA variant matrix for this parent project. Returns VariantSpec items, estimated render £, and soft-cap warnings. Does not create children — call render_variants after founder confirms.',
      inputSchema: z.object({
        platforms: z.array(adPlatformSchema).min(1),
        hookIndexes: z.array(z.number().int().min(0)).min(1),
        ctaIndexes: z.array(z.number().int().min(0)).min(1),
        locales: z.array(localeCodeSchema).max(12).optional(),
        softCap: z.number().int().positive().optional(),
        confirmSpend: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'plan_variants', input, async () => {
          try {
            const plan = planVariantsForParent({
              parent: ctx.project,
              platforms: input.platforms,
              hookIndexes: input.hookIndexes,
              ctaIndexes: input.ctaIndexes,
              locales: input.locales,
              softCap: input.softCap,
              confirmSpend: input.confirmSpend,
            })
            return toolOk(
              `Planned ${plan.items.length} ad versions (create free; export later ~£${plan.exportEstimatedGbp.toFixed(2)}${plan.truncated ? ', soft-capped' : ''})`,
              {
                items: plan.items,
                requestedCount: plan.requestedCount,
                truncated: plan.truncated,
                estimatedGbp: plan.estimatedGbp,
                createEstimatedGbp: plan.createEstimatedGbp,
                exportEstimatedGbp: plan.exportEstimatedGbp,
                warnings: plan.warnings,
              },
            )
          } catch (error) {
            return toolFail(error instanceof Error ? error.message : 'plan_variants failed')
          }
        }),
    }),

    render_variants: tool({
      description:
        'Materialize variant child Studio projects from a plan (shared media blob keys), optionally enqueue Remotion renders. Requires confirmSpend when estimate > 0 or count > soft cap. Pass items from plan_variants.',
      inputSchema: z.object({
        items: z.array(variantSpecSchema).min(1),
        confirmSpend: z.boolean().optional(),
        enqueueRenders: z.boolean().optional(),
        renderTargets: z.enum(['stills', 'mp4', 'both']).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'render_variants', input, async () => {
          try {
            const result = await renderVariantsForParent({
              supabase: ctx.supabase,
              parentProjectId: ctx.projectId,
              items: input.items,
              confirmSpend: input.confirmSpend,
              enqueueRenders: input.enqueueRenders,
              renderTargets: input.renderTargets,
            })
            return toolOk(
              `Created ${result.children.length} ad versions (~£${result.estimatedGbp.toFixed(2)} gated; export later ~£${result.plan.exportEstimatedGbp.toFixed(2)})`,
              {
                estimatedGbp: result.estimatedGbp,
                createEstimatedGbp: result.plan.createEstimatedGbp,
                exportEstimatedGbp: result.plan.exportEstimatedGbp,
                warnings: result.plan.warnings,
                children: result.children,
              },
            )
          } catch (error) {
            return toolFail(error instanceof Error ? error.message : 'render_variants failed')
          }
        }),
    }),

    promote_variant_field: tool({
      description:
        'Copy selected fields from a variant child project onto this parent (main) cut. Never silent whole-project overwrite — pass only the fields the founder confirmed (hook, end_card, brand_cta, clip_trim).',
      inputSchema: z.object({
        childProjectId: z.string().uuid(),
        fields: z.array(promoteFieldSchema).min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'promote_variant_field', input, async () => {
          try {
            const childLoaded = await loadProject(ctx.supabase, input.childProjectId)
            if (childLoaded.row.parent_project_id !== ctx.projectId) {
              return toolFail('Variant child does not belong to this parent project')
            }
            let applied: string[] = []
            let skipped: string[] = []
            const { project } = await applyProjectMutation(
              ctx,
              (current) => {
                const result = applyPromoteFields({
                  parent: current,
                  child: childLoaded.project,
                  fields: input.fields,
                })
                applied = result.applied
                skipped = result.skipped
                return result.project
              },
              'promote_variant_field',
            )
            return toolOk(
              `Promoted ${applied.join(', ')} from ad version onto the main cut${
                skipped.length ? ` (skipped: ${skipped.join(', ')})` : ''
              }`,
              {
                applied,
                skipped,
                revision: project.revision,
              },
            )
          } catch (error) {
            return toolFail(error instanceof Error ? error.message : 'promote_variant_field failed')
          }
        }),
    }),

    render_export: tool({
      description:
        'Enqueue a local Remotion Render Job. Does not encode inside chat. Only call when the user asks to export/render. For slideshows, pass targets: stills | mp4 | both.',
      inputSchema: z.object({
        targets: z.enum(['stills', 'mp4', 'both']).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'render_export', input, async () => {
          if (process.env.STUDIO_RENDER_API === 'false') {
            return toolFail('Render API is disabled (STUDIO_RENDER_API=false)')
          }
          if (cutReviewRequired(ctx.project) && !hasFreshCutReview(ctx.project)) {
            return toolFail(
              'Export is blocked until cut review passes on this cut. Call inspect_preview, fix any failures, then export.',
            )
          }
          const job = await enqueueRenderJob(ctx.supabase, ctx.projectId, {
            targets: input.targets ?? 'both',
          })
          return toolOk(`Queued render job ${job.id}`, {
            jobId: job.id,
            status: job.status,
            targets: input.targets ?? 'both',
          })
        }),
    }),

    plan_slideshow: tool({
      description:
        'Create or replace slides on this project from headlines (or count). If the project is a Video Suite, it becomes a carousel or vertical slideshow so the slides appear on this player. Pass presetId linkedin_carousel_1080 or ig_carousel_1080 for a square pack.',
      inputSchema: z.object({
        headlines: z.array(z.string().min(1).max(120)).optional(),
        count: z.number().int().positive().max(12).optional(),
        presetId: slideshowPresetIdSchema.optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'plan_slideshow', input, async () => {
          const fromComposition = ctx.project.compositionId
          const { project } = await applyProjectMutation(ctx, (current) =>
            planSlideshow(current, input),
          )
          const count = project.slideshow?.slides.length ?? 0
          const converted = fromComposition !== project.compositionId
          const convertNote = converted
            ? ` Converted this cut from ${fromComposition} to ${project.compositionId} so the slides show on this player.`
            : ''
          return toolOk(
            `Planned ${count} slides on this player (${project.width}×${project.height}).${convertNote}`,
            {
              slideIds: project.slideshow?.slides.map((slide) => slide.id) ?? [],
              revision: project.revision,
              compositionId: project.compositionId,
              width: project.width,
              height: project.height,
              converted,
            },
          )
        }),
    }),

    set_slide: tool({
      description:
        'Update one slideshow slide (headline, body, duration, transition, layout, background). Overlay: hero (slide 1 hook), point (numbered step), stat (big number), quote (pull-quote), cta (closing CTA — last slide). Compartments: stack_media_top, stack_type_top, split_media_left, split_media_right — image or type in any cell, not only overlay on a photo.',
      inputSchema: z.object({
        slideId: z.string().min(1),
        headline: z.string().optional(),
        body: z.string().nullable().optional(),
        durationFrames: z.number().int().positive().optional(),
        transition: z.enum(['cut', 'fade', 'kenBurns']).optional(),
        layout: slideLayoutIdSchema.optional(),
        backgroundAssetId: z.string().uuid().nullable().optional(),
        voiceoverCue: z.string().nullable().optional(),
        textSafe: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_slide', input, async () => {
          const { slideId, ...patch } = input
          const { project } = await applyProjectMutation(ctx, (current) =>
            setSlide(current, { slideId, patch }),
          )
          return toolOk(`Updated slide ${slideId}`, { revision: project.revision })
        }),
    }),

    reorder_slides: tool({
      description: 'Reorder slideshow slides by full ordered list of slide ids.',
      inputSchema: z.object({
        orderedIds: z.array(z.string().min(1)).min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'reorder_slides', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            reorderSlides(current, input),
          )
          return toolOk(`Reordered ${input.orderedIds.length} slides`, {
            revision: project.revision,
          })
        }),
    }),

    add_slide: tool({
      description:
        'Add a blank slide to a slideshow (after afterSlideId, or at the end). Empty pack seeds the default slide count for the channel preset. Refuses above preset max.',
      inputSchema: z.object({
        afterSlideId: z.string().min(1).optional(),
        headline: z.string().max(120).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'add_slide', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) => addSlide(current, input))
          const slides = project.slideshow?.slides ?? []
          return toolOk(`Added slide — now ${slides.length} slides`, {
            slideIds: slides.map((slide) => slide.id),
            revision: project.revision,
          })
        }),
    }),

    remove_slide: tool({
      description:
        'Remove one slideshow slide by id. Refuses when at the channel preset minimum slide count.',
      inputSchema: z.object({
        slideId: z.string().min(1),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'remove_slide', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            removeSlide(current, input),
          )
          return toolOk(`Removed slide ${input.slideId}`, {
            slideIds: project.slideshow?.slides.map((slide) => slide.id) ?? [],
            revision: project.revision,
          })
        }),
    }),

    generate_slide_background: tool({
      description:
        'Generate a brand-bound still for one slide and attach it as the background. Required on every slide before a carousel is "done" — solid color plus type is not an ad. Pass apply:false for a candidate. Requires project.brand.',
      inputSchema: z.object({
        slideId: z.string().min(1),
        prompt: z.string().min(1).max(800),
        /** When false, create the asset but do not set the slide background yet. */
        apply: z.boolean().optional().default(true),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'generate_slide_background', input, async () => {
          const used = (ctx.project.slideshow?.slides ?? [])
            .map((slide) => slide.backgroundAssetId)
            .filter((id): id is string => Boolean(id))
          const extractId =
            input.apply === false ? undefined : nextUnusedExtractSlideBackground(ctx.project, used)
          if (extractId) {
            const { project } = await applyProjectMutation(ctx, (current) =>
              setSlideBackground(current, {
                slideId: input.slideId,
                backgroundAssetId: extractId,
              }),
            )
            return toolOk(`Set Product Extract still on ${input.slideId}`, {
              assetId: extractId,
              applied: true,
              fromExtract: true,
              revision: project.revision,
            })
          }
          const gen = await runGenerateImageTool(ctx, { prompt: input.prompt })
          if (!gen.ok) return gen
          const assetId = String((gen.data as { assetId?: string } | undefined)?.assetId ?? '')
          if (!assetId) {
            return toolFail('Image generation did not return an assetId')
          }
          if (input.apply === false) {
            return toolOk(`Generated candidate background for ${input.slideId} (not applied)`, {
              assetId,
              applied: false,
              revision: ctx.project.revision,
            })
          }
          const { project } = await applyProjectMutation(ctx, (current) =>
            setSlideBackground(current, { slideId: input.slideId, backgroundAssetId: assetId }),
          )
          return toolOk(`Set background on ${input.slideId}`, {
            assetId,
            applied: true,
            revision: project.revision,
          })
        }),
    }),

    set_slideshow_voiceover: tool({
      description:
        'Attach a voiceover asset and mode (none | per_slide | continuous) to the slideshow.',
      inputSchema: z.object({
        voiceoverAssetId: z.string().uuid().nullable().optional(),
        voiceoverMode: z.enum(['none', 'per_slide', 'continuous']).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_slideshow_voiceover', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            setSlideshowVoiceover(current, input),
          )
          return toolOk('Updated slideshow voiceover', {
            revision: project.revision,
            voiceoverMode: project.slideshow?.voiceoverMode,
          })
        }),
    }),

    set_campaign_brief: tool({
      description:
        'Save Campaign Pack brief ingredients: prompt, productId, aspect (1:1 | 4:5 | 9:16), optional reference imageAssetIds, notes. Requires composition campaign-pack-still.',
      inputSchema: z.object({
        prompt: z.string().max(2000).optional(),
        productId: z.string().min(1).nullable().optional(),
        aspect: campaignAspectSchema.optional(),
        notes: z.string().max(2000).nullable().optional(),
        imageAssetIds: z.array(z.string().uuid()).max(8).nullable().optional(),
        suggestionSource: z.enum(['manual', 'dna', 'catalog']).nullable().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_campaign_brief', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            setCampaignBrief(current, input),
          )
          return toolOk('Saved campaign brief', {
            brief: project.campaignPack?.brief,
            revision: project.revision,
          })
        }),
    }),

    plan_campaign_creatives: tool({
      description:
        'Create or replace campaignPack.creatives[] from headlines or count (no image spend). Call after set_campaign_brief.',
      inputSchema: z.object({
        headlines: z.array(z.string().min(1).max(120)).optional(),
        count: z.number().int().positive().max(12).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'plan_campaign_creatives', input, async () => {
          const { project } = await applyProjectMutation(ctx, (current) =>
            planCampaignCreatives(current, input),
          )
          return toolOk(`Planned ${project.campaignPack?.creatives.length ?? 0} creatives`, {
            creativeIds: project.campaignPack?.creatives.map((c) => c.id) ?? [],
            revision: project.revision,
          })
        }),
    }),

    set_campaign_creative: tool({
      description:
        'Patch one campaign creative (headline, body, cta, background). Edit a headline without regenerating the whole pack.',
      inputSchema: z.object({
        creativeId: z.string().min(1),
        headline: z.string().optional(),
        body: z.string().nullable().optional(),
        cta: z.string().nullable().optional(),
        backgroundAssetId: z.string().uuid().nullable().optional(),
        motionAssetId: z.string().uuid().nullable().optional(),
        textSafe: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_campaign_creative', input, async () => {
          const { creativeId, ...patch } = input
          const { project } = await applyProjectMutation(ctx, (current) =>
            setCampaignCreative(current, { creativeId, patch }),
          )
          return toolOk(`Updated creative ${creativeId}`, { revision: project.revision })
        }),
    }),

    generate_campaign_creatives: tool({
      description:
        'Batch-generate brand-bound stills for Campaign Pack creatives. Pass estimateOnly:true to price first. When estimate > £0, pass confirmSpend:true after founder confirms. Mock/ci-stub is £0 and does not need confirm. Attributes CostEvents via image generation jobs when persist is on.',
      inputSchema: z.object({
        count: z.number().int().positive().max(12).optional(),
        headlines: z.array(z.string().min(1).max(120)).optional(),
        confirmSpend: z.boolean().optional(),
        estimateOnly: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'generate_campaign_creatives', input, () =>
          runGenerateCampaignCreatives(ctx, input),
        ),
    }),

    import_product_brand: tool({
      description:
        'Optional: copy the Product Brand Library into this project (logo, stills, colors, voice, CTA). Prefer Brand Studio uploads when the founder sets a custom brand. Does not auto-run — generate_* requires project.brand already set.',
      inputSchema: z.object({}),
      execute: async (input) =>
        wrapTool(ctx, 'import_product_brand', input, () => runImportProductBrandTool(ctx)),
    }),

    set_model_profile: tool({
      description:
        'Select the generation profile. Product default is balanced (generates). founder-edit is a local kill-switch only. Gateway image ids pick a stills model. Tests use ci-stub.',
      inputSchema: z.object({
        profileId: z.enum(MODEL_PROFILE_IDS),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'set_model_profile', input, () =>
          runSetModelProfileTool(ctx, input.profileId),
        ),
    }),

    generate_image: tool({
      description:
        'Generate a still with the profile IMAGE model (not the chat/reasoner). Use whenever the user asks to generate/create/draw/make an image/still/thumbnail/end screen photo. Then call add_clip with the returned assetId in the same turn. On an authored motion project, do not use this to fake the ad — write_composition or patch_composition; never add_clip the still onto MAIN. A still for DeviceFrame inputProps is OK. If disabled, call set_model_profile(gemini-flash-image) and retry — do not ask the user or say please wait. Requires project.brand (Brand Studio or import_product_brand). Duration auto-grows for past-end placement.',
      inputSchema: z.object({
        prompt: z.string().min(1).max(800),
        aspectRatio: z.string().optional(),
        referenceAssetIds: z.array(z.string().uuid()).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'generate_image', input, () => runGenerateImageTool(ctx, input)),
    }),

    generate_voiceover: tool({
      description:
        'Generate a spoken voiceover with the Brand kit voice, then place it on the audio track so Play has speech. Call this when they ask for voiceover, VO, narration, or a spoken track — do not claim a speaker exists until this tool succeeds. Pass confirmSpend=true when the estimate is > £0. Requires project.brand.',
      inputSchema: z.object({
        text: z.string().min(1).max(2000),
        confirmSpend: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'generate_voiceover', input, () => runGenerateVoiceoverTool(ctx, input)),
    }),

    generate_music: tool({
      description:
        'Generate an instrumental music bed via ElevenLabs Music (live). Pass confirmSpend=true when the estimate is > £0. Mock only on ci-stub. Places the bed on the audio track unless placeOnTimeline=false.',
      inputSchema: z.object({
        prompt: z.string().min(1).max(800),
        durationSeconds: z.number().positive().max(120).optional(),
        forceInstrumental: z.boolean().optional(),
        confirmSpend: z.boolean().optional(),
        placeOnTimeline: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'generate_music', input, () => runGenerateMusicTool(ctx, input)),
    }),

    duck_music: tool({
      description:
        'Lower the music bed under speech with a deterministic volume envelope (no model, no spend). Pass clipId to target one bed; otherwise ducks every music_bed clip. Skip if the envelope is already applied. Needs a talking-head take on the timeline.',
      inputSchema: z.object({
        clipId: z.string().min(1).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'duck_music', input, () => runDuckMusicTool(ctx, input)),
    }),

    transcribe_media: tool({
      description:
        'Transcribe an audio or video project asset for captions. Pass assetId (UUID). When the user says "transcribe" with an @asset:… mention, use that assetId from the Asset references block. If they name an uploaded VO without a token, pick the matching audio asset from the project summary.',
      inputSchema: z.object({
        assetId: z.string().uuid(),
        confirmSpend: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'transcribe_media', input, () => runTranscribeTool(ctx, input)),
    }),

    enhance_speech: tool({
      description:
        'Reduce noise/echo on a talking-head clip’s audio. Creates a new asset and swaps it onto the clip. Generation Job. Pass clipId (preferred) or assetId. confirmSpend=true when the estimate is > £0. Stub/CI copies media and stamps probe.speechEnhanced — never calls a live vendor. Skip if already enhanced.',
      inputSchema: z.object({
        clipId: z.string().min(1).optional(),
        assetId: z.string().uuid().optional(),
        confirmSpend: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'enhance_speech', input, () => runEnhanceSpeechTool(ctx, input)),
    }),

    reframe_clip: tool({
      description:
        'Subject-tracking pan/scan on a talking-head clip to 9:16, 16:9, 1:1, or 4:5. Writes clip.reframe (0–1 crop windows). Generation Job. Does not bake a second MP4. Stub tracks center (or probe.face). Skip if that aspect is already applied. Pass clipId and aspect (default 9:16).',
      inputSchema: z.object({
        clipId: z.string().min(1).optional(),
        aspect: z.enum(['9:16', '16:9', '1:1', '4:5']).optional(),
        subjectHint: z.enum(['face', 'center']).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'reframe_clip', input, () => runReframeClipTool(ctx, input)),
    }),

    generate_video_clip: tool({
      description:
        'Generate a video clip and place it on the main picture track (image-to-video preferred). Omit durationSeconds to fill the remaining brief in one clip. When the founder asked for Ns, pass durationSeconds=N — do not pass 8s for a 15s ad. Seedance 2.0 Fast allows 4–15s; Seedance 2.5 up to 30s; Veo 4/6/8s. The tool snaps below-minimum values up (never send 2s). A follow-up clip automatically continues the last MAIN shot as [Video 1] — write the next beat, not a new film. Pass every mentioned product still as sourceImageAssetIds — first is the first frame, the rest are references. Mentioned video clips are sent as Seedance [Video n] refs; Veo fails before spend. If that is more stills or videos than the active model allows, the tool fails before spend so the user can drop extras. Never silently drop a tagged @asset. If video generation is off, fail and say so — do not fake an ad with stills. When estimate > £0, pass confirmSpend=true after showing the estimate. Pass placeOnTimeline=false to only create the asset. Never treats raw clip as Final.',
      inputSchema: z.object({
        prompt: z.string().min(1).max(800),
        durationSeconds: z.number().positive().max(120).optional(),
        sourceImageAssetId: z.string().uuid().optional(),
        sourceImageAssetIds: z.array(z.string().uuid()).max(50).optional(),
        confirmSpend: z.boolean().optional(),
        placeOnTimeline: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'generate_video_clip', input, () => runGenerateVideoClipTool(ctx, input)),
    }),

    list_branches: tool({
      description:
        'List named Studio Project branches (main / Funny / …). Distinct from Ad Generator variant child projects. Use before switch_branch or create_branch.',
      inputSchema: z.object({}),
      execute: async (input) =>
        wrapTool(ctx, 'list_branches', input, async () => {
          if (!ctx.persist) {
            return toolFail('list_branches requires a persisted project')
          }
          const listed = await listBranchSummaries(ctx.supabase, ctx.projectId)
          return toolOk(`Listed ${listed.branches.length} branch(es)`, listed)
        }),
    }),

    find_assets: tool({
      description:
        'Semantic search over the product asset index (captions/transcripts embeddings). Use to find funny takes, product close-ups, etc. before place_clip / add_clip.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(400),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'find_assets', input, async () => {
          const hits = await findAssetsSemantic({
            supabase: ctx.supabase,
            productId: ctx.productId,
            query: input.query,
            limit: input.limit,
            useMock: ctx.modelProfileId === 'ci-stub',
          })
          return toolOk(`Found ${hits.length} asset(s) for “${input.query}”`, { hits })
        }),
    }),

    find_moments: tool({
      description:
        'Search indexed Shots (Moments) in this product library. Matches appearance (visual embeddings) fused with tags, captions, transcript windows, and per-shot text embeddings. Pass imageAssetId (a still) to search visually similar Shots. Pass sort=highlight to boost Analyze highlight scores when those rows exist. Returns shotId + startMs/endMs so a 2s beat can be placed with place_shot. Empty index or missing visual rows returns tag/caption/text hits (not an error).',
      inputSchema: z
        .object({
          query: z.string().trim().min(1).max(400).optional(),
          imageAssetId: z.string().uuid().optional(),
          tag: z.string().trim().min(1).max(64).optional(),
          sceneRole: sceneRoleSchema.optional(),
          limit: z.number().int().min(1).max(50).optional(),
          sort: z.enum(['relevance', 'highlight']).optional(),
        })
        .refine((value) => Boolean(value.query || value.imageAssetId), {
          message: 'Pass query or imageAssetId',
        }),
      execute: async (input) =>
        wrapTool(ctx, 'find_moments', input, async () => {
          const hits = await findMoments({
            supabase: ctx.supabase,
            productId: ctx.productId,
            query: input.query ?? '',
            imageAssetId: input.imageAssetId,
            tag: input.tag,
            sceneRole: input.sceneRole,
            limit: input.limit,
            sort: input.sort,
            useMock: ctx.modelProfileId === 'ci-stub',
            blobEnv: ctx.blobEnv,
          })
          return toolOk(`Found ${hits.length} moment(s) for “${input.query}”`, { hits })
        }),
    }),

    place_shot: tool({
      description:
        'Place an indexed Shot onto the timeline using its in/out (not the whole take). Omit trackId for A-roll. Use trackId "broll" / "pip" / "track_broll" for picture-in-picture. Requires the asset already on the project.',
      inputSchema: z.object({
        shotId: z.string().uuid(),
        from: z.number().int().nonnegative().optional(),
        trackId: z.string().min(1).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'place_shot', input, async () => {
          const shot = await loadIndexedShot({
            supabase: ctx.supabase,
            productId: ctx.productId,
            shotId: input.shotId,
          })
          if (!shot) {
            return toolFail(`No indexed shot ${input.shotId} in this product`)
          }
          const { project } = await applyProjectMutation(ctx, (current) =>
            placeShotOnProject(current, {
              assetId: shot.assetId,
              startMs: shot.startMs,
              endMs: shot.endMs,
              trackId: input.trackId,
              from: input.from,
            }),
          )
          const clip = project.clips.at(-1)
          return toolOk(
            `Placed shot ${shot.id} (${clip?.durationInFrames ?? 0}f from ${clip?.trim.startFrames ?? 0}f)`,
            {
              clipId: clip?.id,
              assetId: shot.assetId,
              shotId: shot.id,
              trackId: clip?.trackId,
              from: clip?.from ?? input.from ?? 0,
              trimStartFrames: clip?.trim.startFrames,
              durationInFrames: clip?.durationInFrames,
              revision: project.revision,
            },
          )
        }),
    }),

    list_assets_by_tag: tool({
      description:
        'List indexed assets matching an exact tag (or prefix). Tags are lowercase normalized strings from caption indexing.',
      inputSchema: z.object({
        tag: z.string().trim().min(1).max(64),
        prefix: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'list_assets_by_tag', input, async () => {
          const hits = await listAssetsByTag({
            supabase: ctx.supabase,
            productId: ctx.productId,
            tag: input.tag,
            prefix: input.prefix,
            limit: input.limit,
          })
          return toolOk(`Listed ${hits.length} asset(s) for tag “${input.tag}”`, { hits })
        }),
    }),

    describe_asset: tool({
      description:
        'Return caption, tags, shots, and transcript excerpt for one indexed asset id in this product.',
      inputSchema: z.object({
        assetId: z.string().uuid(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'describe_asset', input, async () => {
          const description = await describeAssetIndex({
            supabase: ctx.supabase,
            productId: ctx.productId,
            assetId: input.assetId,
          })
          if (!description) {
            return toolFail(`No index for asset ${input.assetId} in this product`)
          }
          return toolOk(`Described asset ${input.assetId}`, { asset: description })
        }),
    }),

    analyze_asset: tool({
      description:
        'Run a prompt + JSON schema over a library asset or Shot window (thumbs + transcript excerpt). Writes asset_analyses. kind=segment upserts event-like asset_shots (new ids; already-placed clip trims stay). Use for library questions, segmentation, compliance, or highlights. Still call inspect_preview before finishing a make-video turn. confirmSpend=true when the estimate is > £0. Missing thumbs: retry index, do not invent frames.',
      inputSchema: z.object({
        assetId: z.string().uuid(),
        shotId: z.string().uuid().optional(),
        startMs: z.number().int().nonnegative().optional(),
        endMs: z.number().int().nonnegative().optional(),
        prompt: z.string().trim().min(1).max(2000),
        schema: z
          .object({
            type: z.string().optional(),
            properties: z.record(z.string(), z.unknown()).optional(),
            required: z.array(z.string()).optional(),
          })
          .passthrough()
          .optional(),
        kind: analyzeKindSchema.optional(),
        schemaId: z.string().trim().min(1).max(64).optional(),
        confirmSpend: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'analyze_asset', input, async () => {
          const out = await analyzeAsset({
            supabase: ctx.supabase,
            blobEnv: ctx.blobEnv,
            productId: ctx.productId,
            projectId: ctx.projectId,
            modelProfileId: ctx.modelProfileId,
            assetId: input.assetId,
            shotId: input.shotId,
            startMs: input.startMs,
            endMs: input.endMs,
            prompt: input.prompt,
            schema: input.schema,
            kind: input.kind,
            schemaId: input.schemaId,
            confirmSpend: Boolean(input.confirmSpend || ctx.confirmSpend),
            persist: ctx.persist,
          })
          const motionScenePlan = motionScenePlanFromAnalyses({
            analyses: [
              {
                kind: out.kind,
                result: out.result,
                assetId: out.assetId,
                shotId: out.shotId,
                startMs: out.startMs,
                endMs: out.endMs,
              },
            ],
            motionSeed: ctx.project.compositionSource?.motionSeed ?? ctx.project.id,
          })
          return toolOk(`Analyzed asset ${out.assetId}`, { analysis: out, motionScenePlan })
        }),
    }),

    extract_product_pages: tool({
      description:
        'Enqueue a public-page extract into the Product Extracts bin (screenshots + copy). Call this when they paste a product URL and ask to extract / capture stills. Do not write_composition or generate_music on that turn. Pass urls (https only). confirmSpend=true when the estimate is > £0. Local worker fills the bin — watch the banner under the player.',
      inputSchema: z.object({
        urls: z.array(z.string().url()).max(20).optional(),
        url: z.string().url().optional(),
        confirmSpend: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'extract_product_pages', input, () => runExtractProductPagesTool(ctx, input)),
    }),

    create_branch: tool({
      description:
        'Fork the active tip into a new named branch (Funny / Luxury / Emotional). Does not replace main. Optionally switch to the new branch afterwards.',
      inputSchema: z.object({
        name: z.string().trim().min(1).max(40),
        switchAfter: z.boolean().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'create_branch', input, async () => {
          if (!ctx.persist) {
            return toolFail('create_branch requires a persisted project')
          }
          const created = await createBranchFromActiveTip(ctx.supabase, {
            projectId: ctx.projectId,
            name: input.name,
          })
          if (input.switchAfter) {
            const switched = await switchActiveBranch(ctx.supabase, {
              projectId: ctx.projectId,
              branchId: created.branch.id,
            })
            ctx.project = switched.project
            ctx.expectedRevision = switched.project.revision
            return toolOk(`Created and switched to branch ${created.branch.name}`, {
              branchId: created.branch.id,
              slug: created.branch.slug,
              revision: switched.project.revision,
              switched: true,
            })
          }
          return toolOk(`Created branch ${created.branch.name}`, {
            branchId: created.branch.id,
            slug: created.branch.slug,
            revision: created.branch.revision,
            switched: false,
          })
        }),
    }),

    switch_branch: tool({
      description:
        'Switch the active named branch tip into the project mirror. Subsequent edits target that branch. Pass branchSlug or branchId.',
      inputSchema: z
        .object({
          branchSlug: z.string().trim().min(1).optional(),
          branchId: z.string().uuid().optional(),
        })
        .refine((value) => Boolean(value.branchSlug || value.branchId), {
          message: 'branchSlug or branchId is required',
        }),
      execute: async (input) =>
        wrapTool(ctx, 'switch_branch', input, async () => {
          if (!ctx.persist) {
            return toolFail('switch_branch requires a persisted project')
          }
          const switched = await switchActiveBranch(ctx.supabase, {
            projectId: ctx.projectId,
            branchId: input.branchId,
            slug: input.branchSlug,
          })
          ctx.project = switched.project
          ctx.expectedRevision = switched.project.revision
          return toolOk(`Switched to branch ${switched.branch.name}`, {
            branchId: switched.branch.id,
            slug: switched.branch.slug,
            revision: switched.project.revision,
          })
        }),
    }),

    promote_branch: tool({
      description:
        'Copy a non-main branch tip onto main (full replace). Source branch is kept. Distinct from promote_variant_field (variant child projects).',
      inputSchema: z
        .object({
          sourceBranchSlug: z.string().trim().min(1).optional(),
          sourceBranchId: z.string().uuid().optional(),
        })
        .refine((value) => Boolean(value.sourceBranchSlug || value.sourceBranchId), {
          message: 'sourceBranchSlug or sourceBranchId is required',
        }),
      execute: async (input) =>
        wrapTool(ctx, 'promote_branch', input, async () => {
          if (!ctx.persist) {
            return toolFail('promote_branch requires a persisted project')
          }
          const promoted = await promoteBranchToMain(ctx.supabase, {
            projectId: ctx.projectId,
            sourceBranchId: input.sourceBranchId,
            sourceSlug: input.sourceBranchSlug,
          })
          if (promoted.row.active_branch_id === promoted.target.id) {
            ctx.project = promoted.project
            ctx.expectedRevision = promoted.project.revision
          }
          return toolOk(`Promoted ${promoted.source.name} onto main`, {
            sourceBranchId: promoted.source.id,
            mainRevision: promoted.target.revision,
          })
        }),
    }),

    merge_branch: tool({
      description:
        'v1 full-tip replace: copy source branch tip onto target (default main). Overwrites target tip; no 3-way merge. Prefer promote_branch when target is main.',
      inputSchema: z.object({
        sourceBranchSlug: z.string().trim().min(1),
        targetBranchSlug: z.string().trim().min(1).optional(),
        expectedTargetRevision: z.number().int().positive().optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'merge_branch', input, async () => {
          if (!ctx.persist) {
            return toolFail('merge_branch requires a persisted project')
          }
          const merged = await mergeBranchTip(ctx.supabase, {
            projectId: ctx.projectId,
            sourceSlug: input.sourceBranchSlug,
            targetSlug: input.targetBranchSlug,
            expectedTargetRevision: input.expectedTargetRevision,
          })
          if (merged.row.active_branch_id === merged.target.id) {
            ctx.project = merged.project
            ctx.expectedRevision = merged.project.revision
          }
          return toolOk(
            `Merged ${merged.source.name} into ${merged.target.name} (full tip replace)`,
            {
              sourceBranchId: merged.source.id,
              targetBranchId: merged.target.id,
              targetRevision: merged.target.revision,
            },
          )
        }),
    }),

    plan_campaign: tool({
      description:
        'Propose a human-gated campaign plan + actions for an existing marketing goal (ADR-0040). Does not spend or publish; actions await approval except noop_verify.',
      inputSchema: z.object({
        goalId: z.string().uuid(),
        planTitle: z.string().trim().min(1).max(200).optional(),
        planSummary: z.string().trim().max(4000).optional(),
      }),
      execute: async (input) =>
        wrapTool(ctx, 'plan_campaign', input, async () => {
          if (!ctx.persist) {
            return toolFail('plan_campaign requires a persisted product context')
          }
          try {
            const result = await planCampaignForGoal(ctx.supabase, {
              productId: ctx.productId,
              goalId: input.goalId,
              planTitle: input.planTitle,
              planSummary: input.planSummary,
            })
            return toolOk(`Proposed plan with ${result.actions.length} gated action(s)`, {
              goalId: result.goal.id,
              planId: result.plan.id,
              actionIds: result.actions.map((action) => action.id),
              actions: result.actions.map((action) => ({
                id: action.id,
                title: action.title,
                actionType: action.actionType,
                status: action.status,
                requiresApproval: action.requiresApproval,
              })),
            })
          } catch (error) {
            return toolFail(error instanceof Error ? error.message : 'plan_campaign failed')
          }
        }),
    }),
    ...createLocaleTools(ctx),
    ...createLibraryTools(ctx),
    ...createStylePackTools(ctx),
    ...createPipLayoutTools(ctx),
    ...createStructureTools(ctx),
    ...createVoiceStudioTools(ctx),
    ...createSfxStudioTools(ctx),
    ...createBrollTools(ctx),
    ...createGenerationPlanTools(ctx),
    ...createCriticTools(ctx),
    ...createCompositionTools(ctx),
  })

export type StudioTools = ReturnType<typeof createStudioTools>
