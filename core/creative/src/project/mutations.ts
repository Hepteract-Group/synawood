import { z } from 'zod'
import { resolveEndCardText } from '../intent/cta-from-behaviour'
import {
  addCaptions,
  addClip,
  addText,
  fitDurationToContent,
  packClips,
  placeClip,
  placeOverlay,
  placeSticker,
  removeClip,
  removeOverlay,
  rippleDeleteClip,
  setCoverFrame,
  setEndCard,
  setHookTitle,
  setTrackFlags,
  splitClip,
  trimClip,
  updateOverlay,
} from './operations'
import { addSlide, planSlideshow, removeSlide, reorderSlides, setSlide } from './slide-ops'
import {
  addCampaignCreative,
  clearCampaignCreativeMedia,
  planCampaignCreatives,
  removeCampaignCreative,
  setCampaignBrief,
  setCampaignCreative,
} from './campaign-ops'
import {
  applyEffectToClip,
  applyFilterToClip,
  clearEffectFromClip,
  regenEffect,
} from '../effects/apply'
import { addThumbnailCandidate, pickThumbnail } from './approval-thumbnail'
import { applyMotionPreset } from '../effects/motion-presets'
import { setCaptionStyle } from '../overlays/caption-emphasis'
import { findSfxAsset, placeSfx } from '../audio/place-sfx'
import { slideLayoutIdSchema, slideTransitionSchema } from './slides'
import {
  overlayLayoutSchema,
  overlayStyleSchema,
  captionWordSchema,
  type StudioProject,
} from './schema'
import { slideshowPresetIdSchema } from '../presets/slideshow'
import { campaignAspectSchema } from './campaign-pack'

export const studioMutationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_clip'),
    assetId: z.string().uuid(),
    from: z.number().int().nonnegative(),
    trackId: z.string().min(1).optional(),
    durationInFrames: z.number().int().positive().optional(),
    trimStartFrames: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('place_clip'),
    clipId: z.string().min(1),
    from: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('pack_clips'),
    trackId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('trim_clip'),
    clipId: z.string().min(1),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive(),
    trimStartFrames: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('split_clip'),
    clipId: z.string().min(1),
    atFrame: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('remove_clip'),
    clipId: z.string().min(1),
  }),
  z.object({
    type: z.literal('ripple_delete_clip'),
    clipId: z.string().min(1),
  }),
  z.object({
    type: z.literal('place_overlay'),
    overlayId: z.string().min(1),
    from: z.number().int().nonnegative(),
    durationInFrames: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('remove_overlay'),
    overlayId: z.string().min(1),
  }),
  z.object({
    type: z.literal('set_track_flags'),
    trackId: z.string().min(1),
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
    muted: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('set_cover_frame'),
    frame: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('fit_duration'),
  }),
  z.object({
    type: z.literal('set_hook_title'),
    text: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal('set_end_card'),
    text: z.string().min(1).max(160).optional(),
  }),
  z.object({
    type: z.literal('add_captions'),
    text: z.string().min(1).max(400),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    style: overlayStyleSchema.optional(),
    words: z.array(captionWordSchema).max(80).optional(),
  }),
  z.object({
    type: z.literal('add_text'),
    text: z.string().min(1).max(240),
    kind: z.enum(['title', 'hook_title', 'end_card', 'lower_third']).optional(),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    layout: overlayLayoutSchema.optional(),
    style: overlayStyleSchema.optional(),
    libraryItemId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('update_overlay'),
    overlayId: z.string().min(1),
    text: z.string().min(1).max(400).optional(),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    layout: overlayLayoutSchema.optional(),
    style: overlayStyleSchema.nullable().optional(),
    libraryItemId: z.string().min(1).nullable().optional(),
  }),
  z.object({
    type: z.literal('set_caption_style'),
    overlayId: z.string().min(1).optional(),
    karaoke: z.boolean().optional(),
    highlight: z.boolean().optional(),
    emoji: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('place_sticker'),
    stickerId: z.string().min(1),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    layout: overlayLayoutSchema.optional(),
    blobKey: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('place_sfx'),
    packId: z.enum(['whoosh', 'hit']),
    from: z.number().int().nonnegative(),
    blobKey: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('apply_motion_preset'),
    clipId: z.string().min(1),
    presetId: z.enum(['hook_punch', 'cta_hit']),
  }),
  z.object({
    type: z.literal('apply_filter'),
    clipId: z.string().min(1),
    filterId: z.string().min(1).max(80).nullable(),
    intensity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal('clear_filter'),
    clipId: z.string().min(1),
  }),
  z.object({
    type: z.literal('apply_effect'),
    clipId: z.string().min(1),
    effectId: z.string().min(1).max(80),
    intensity: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal('clear_effect'),
    clipId: z.string().min(1),
    effectId: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal('regen_effect'),
    clipId: z.string().min(1),
    effectId: z.string().min(1).max(80).optional(),
  }),
  z.object({
    type: z.literal('add_thumbnail_candidate'),
    assetId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('pick_thumbnail'),
    assetId: z.string().uuid().nullable(),
  }),
  z.object({
    type: z.literal('plan_slideshow'),
    headlines: z.array(z.string()).optional(),
    count: z.number().int().positive().optional(),
    presetId: slideshowPresetIdSchema.optional(),
  }),
  z.object({
    type: z.literal('set_slide'),
    slideId: z.string().min(1),
    headline: z.string().optional(),
    body: z.string().nullable().optional(),
    durationFrames: z.number().int().positive().optional(),
    transition: slideTransitionSchema.optional(),
    layout: slideLayoutIdSchema.optional(),
    backgroundAssetId: z.string().uuid().nullable().optional(),
    voiceoverCue: z.string().nullable().optional(),
    textSafe: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('reorder_slides'),
    orderedIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('add_slide'),
    afterSlideId: z.string().min(1).optional(),
    headline: z.string().optional(),
  }),
  z.object({
    type: z.literal('remove_slide'),
    slideId: z.string().min(1),
  }),
  z.object({
    type: z.literal('set_campaign_brief'),
    prompt: z.string().max(2000).optional(),
    productId: z.string().min(1).nullable().optional(),
    aspect: campaignAspectSchema.optional(),
    notes: z.string().max(2000).nullable().optional(),
    imageAssetIds: z.array(z.string().uuid()).max(8).nullable().optional(),
    suggestionSource: z.enum(['manual', 'dna', 'catalog']).nullable().optional(),
  }),
  z.object({
    type: z.literal('plan_campaign_creatives'),
    headlines: z.array(z.string()).optional(),
    count: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('set_campaign_creative'),
    creativeId: z.string().min(1),
    headline: z.string().optional(),
    body: z.string().nullable().optional(),
    cta: z.string().nullable().optional(),
    backgroundAssetId: z.string().uuid().nullable().optional(),
    motionAssetId: z.string().uuid().nullable().optional(),
    motionJobId: z.string().uuid().nullable().optional(),
    textSafe: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('add_campaign_creative'),
    headline: z.string().max(120).optional(),
  }),
  z.object({
    type: z.literal('remove_campaign_creative'),
    creativeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('clear_campaign_creative_media'),
    creativeId: z.string().min(1),
  }),
])

export type StudioMutation = z.infer<typeof studioMutationSchema>

export const applyStudioMutation = (
  project: StudioProject,
  mutation: StudioMutation,
): StudioProject => {
  switch (mutation.type) {
    case 'add_clip':
      return addClip(project, mutation)
    case 'place_clip':
      return placeClip(project, mutation.clipId, mutation.from)
    case 'pack_clips':
      return packClips(project, { trackId: mutation.trackId })
    case 'trim_clip':
      return trimClip(project, mutation.clipId, mutation)
    case 'split_clip':
      return splitClip(project, mutation.clipId, mutation.atFrame)
    case 'remove_clip':
      return removeClip(project, mutation.clipId)
    case 'ripple_delete_clip':
      return rippleDeleteClip(project, mutation.clipId)
    case 'place_overlay':
      return placeOverlay(project, mutation.overlayId, mutation)
    case 'remove_overlay':
      return removeOverlay(project, mutation.overlayId)
    case 'set_track_flags':
      return setTrackFlags(project, mutation.trackId, mutation)
    case 'set_cover_frame':
      return setCoverFrame(project, mutation.frame)
    case 'fit_duration':
      return fitDurationToContent(project)
    case 'set_hook_title':
      return setHookTitle(project, mutation.text)
    case 'set_end_card':
      return setEndCard(project, mutation.text ?? resolveEndCardText(project))
    case 'add_captions':
      return addCaptions(project, {
        text: mutation.text,
        from: mutation.from,
        durationInFrames: mutation.durationInFrames,
        style: mutation.style,
        words: mutation.words,
      })
    case 'add_text':
      return addText(project, {
        text: mutation.text,
        kind: mutation.kind,
        from: mutation.from,
        durationInFrames: mutation.durationInFrames,
        layout: mutation.layout,
        style: mutation.style,
        libraryItemId: mutation.libraryItemId,
      })
    case 'update_overlay':
      return updateOverlay(project, {
        overlayId: mutation.overlayId,
        text: mutation.text,
        from: mutation.from,
        durationInFrames: mutation.durationInFrames,
        layout: mutation.layout,
        style: mutation.style,
        libraryItemId: mutation.libraryItemId,
      })
    case 'set_caption_style':
      return setCaptionStyle(project, {
        overlayId: mutation.overlayId,
        karaoke: mutation.karaoke,
        highlight: mutation.highlight,
        emoji: mutation.emoji,
      })
    case 'place_sticker':
      return placeSticker(project, {
        stickerId: mutation.stickerId,
        from: mutation.from,
        durationInFrames: mutation.durationInFrames,
        layout: mutation.layout,
        blobKey: mutation.blobKey,
      })
    case 'place_sfx': {
      const existing = findSfxAsset(project, mutation.packId)
      if (!existing && !mutation.blobKey) {
        throw new Error('Missing sound file')
      }
      return placeSfx(project, {
        packId: mutation.packId,
        from: mutation.from,
        blobKey: mutation.blobKey,
      })
    }
    case 'apply_motion_preset':
      return applyMotionPreset(project, {
        clipId: mutation.clipId,
        presetId: mutation.presetId,
      })
    case 'apply_filter':
      return applyFilterToClip(project, {
        clipId: mutation.clipId,
        filterId: mutation.filterId,
        intensity: mutation.intensity,
      })
    case 'clear_filter':
      return applyFilterToClip(project, { clipId: mutation.clipId, filterId: null })
    case 'apply_effect':
      return applyEffectToClip(project, {
        clipId: mutation.clipId,
        effectId: mutation.effectId,
        intensity: mutation.intensity,
      })
    case 'clear_effect':
      return clearEffectFromClip(project, {
        clipId: mutation.clipId,
        effectId: mutation.effectId,
      })
    case 'regen_effect':
      return regenEffect(project, {
        clipId: mutation.clipId,
        effectId: mutation.effectId,
      })
    case 'add_thumbnail_candidate':
      return addThumbnailCandidate(project, mutation.assetId)
    case 'pick_thumbnail':
      return pickThumbnail(project, mutation.assetId)
    case 'plan_slideshow':
      return planSlideshow(project, {
        headlines: mutation.headlines,
        count: mutation.count,
        presetId: mutation.presetId,
      })
    case 'set_slide':
      return setSlide(project, {
        slideId: mutation.slideId,
        patch: {
          headline: mutation.headline,
          body: mutation.body,
          durationFrames: mutation.durationFrames,
          transition: mutation.transition,
          layout: mutation.layout,
          backgroundAssetId: mutation.backgroundAssetId,
          voiceoverCue: mutation.voiceoverCue,
          textSafe: mutation.textSafe,
        },
      })
    case 'reorder_slides':
      return reorderSlides(project, { orderedIds: mutation.orderedIds })
    case 'add_slide':
      return addSlide(project, {
        afterSlideId: mutation.afterSlideId,
        headline: mutation.headline,
      })
    case 'remove_slide':
      return removeSlide(project, { slideId: mutation.slideId })
    case 'set_campaign_brief':
      return setCampaignBrief(project, {
        prompt: mutation.prompt,
        productId: mutation.productId,
        aspect: mutation.aspect,
        notes: mutation.notes,
        imageAssetIds: mutation.imageAssetIds,
        suggestionSource: mutation.suggestionSource,
      })
    case 'plan_campaign_creatives':
      return planCampaignCreatives(project, {
        headlines: mutation.headlines,
        count: mutation.count,
      })
    case 'set_campaign_creative':
      return setCampaignCreative(project, {
        creativeId: mutation.creativeId,
        patch: {
          headline: mutation.headline,
          body: mutation.body,
          cta: mutation.cta,
          backgroundAssetId: mutation.backgroundAssetId,
          motionAssetId: mutation.motionAssetId,
          motionJobId: mutation.motionJobId,
          textSafe: mutation.textSafe,
        },
      })
    case 'add_campaign_creative':
      return addCampaignCreative(project, { headline: mutation.headline })
    case 'remove_campaign_creative':
      return removeCampaignCreative(project, { creativeId: mutation.creativeId })
    case 'clear_campaign_creative_media':
      return clearCampaignCreativeMedia(project, { creativeId: mutation.creativeId })
  }
}

export const summarizeStudioMutation = (mutation: StudioMutation): string => {
  switch (mutation.type) {
    case 'add_clip':
      return `Added asset ${mutation.assetId} at frame ${mutation.from}`
    case 'place_clip':
      return `Moved clip ${mutation.clipId} to frame ${mutation.from}`
    case 'pack_clips':
      return mutation.trackId ? `Packed clips on ${mutation.trackId}` : 'Packed clips (closed gaps)'
    case 'trim_clip':
      return `Trimmed clip ${mutation.clipId}`
    case 'split_clip':
      return `Split clip ${mutation.clipId} at frame ${mutation.atFrame}`
    case 'remove_clip':
      return `Removed clip ${mutation.clipId}`
    case 'ripple_delete_clip':
      return `Ripple deleted clip ${mutation.clipId}`
    case 'place_overlay':
      return mutation.durationInFrames != null
        ? `Resized overlay ${mutation.overlayId} to ${mutation.durationInFrames}f at frame ${mutation.from}`
        : `Moved overlay ${mutation.overlayId} to frame ${mutation.from}`
    case 'remove_overlay':
      return `Removed overlay ${mutation.overlayId}`
    case 'set_track_flags':
      return `Updated track ${mutation.trackId} chrome flags`
    case 'set_cover_frame':
      return `Set cover frame to ${mutation.frame}`
    case 'fit_duration':
      return 'Fitted project duration to content'
    case 'set_hook_title':
      return `Set hook title to "${mutation.text}"`
    case 'set_end_card':
      return mutation.text ? `Set end card to "${mutation.text}"` : 'Set end card from Intent.cta'
    case 'add_captions':
      return `Added captions "${mutation.text}"`
    case 'add_text':
      return `Added ${mutation.kind ?? 'title'} "${mutation.text}"`
    case 'update_overlay':
      return `Updated overlay ${mutation.overlayId}`
    case 'set_caption_style':
      if (mutation.emoji === false) return 'Cleared caption marks'
      if (mutation.highlight === false) return 'Cleared caption highlights'
      if (mutation.emoji === true) return 'Updated caption marks'
      return 'Updated caption highlights'
    case 'place_sticker':
      return `Placed sticker ${mutation.stickerId}`
    case 'place_sfx':
      return mutation.packId === 'whoosh' ? 'Added a whoosh' : 'Added a hit'
    case 'apply_motion_preset':
      return mutation.presetId === 'hook_punch'
        ? 'Added a punch on the hook'
        : 'Added a punch on the call to action'
    case 'apply_filter':
      return mutation.filterId
        ? `Applied ${mutation.filterId} to ${mutation.clipId}`
        : `Cleared filter on ${mutation.clipId}`
    case 'clear_filter':
      return `Cleared filter on ${mutation.clipId}`
    case 'apply_effect':
      return `Applied ${mutation.effectId} to ${mutation.clipId}`
    case 'clear_effect':
      return `Cleared ${mutation.effectId} on ${mutation.clipId}`
    case 'regen_effect':
      return mutation.effectId
        ? `Tried ${mutation.effectId} again on ${mutation.clipId}`
        : `Tried the last treatment again on ${mutation.clipId}`
    case 'add_thumbnail_candidate':
      return 'Added a thumbnail option'
    case 'pick_thumbnail':
      return mutation.assetId ? 'Picked a thumbnail' : 'Cleared the thumbnail'
    case 'plan_slideshow':
      return `Planned slideshow (${mutation.headlines?.length ?? mutation.count ?? 'default'} slides)`
    case 'set_slide':
      return `Updated slide ${mutation.slideId}`
    case 'reorder_slides':
      return `Reordered ${mutation.orderedIds.length} slides`
    case 'add_slide':
      return mutation.afterSlideId ? `Added slide after ${mutation.afterSlideId}` : 'Added slide'
    case 'remove_slide':
      return `Removed slide ${mutation.slideId}`
    case 'set_campaign_brief':
      return 'Updated campaign brief'
    case 'plan_campaign_creatives':
      return `Planned campaign creatives (${mutation.headlines?.length ?? mutation.count ?? 'default'})`
    case 'set_campaign_creative':
      return `Updated creative ${mutation.creativeId}`
    case 'add_campaign_creative':
      return 'Added campaign creative'
    case 'remove_campaign_creative':
      return `Removed creative ${mutation.creativeId}`
    case 'clear_campaign_creative_media':
      return `Cleared still/motion on ${mutation.creativeId}`
  }
}
