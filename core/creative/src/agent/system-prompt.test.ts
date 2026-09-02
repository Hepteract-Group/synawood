import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from './system-prompt'
import type { MarketingSkill } from './skills/select'

const base = {
  productId: 'demo',
  marketingDocExcerpt: 'the private example helps people edit PDFs.',
  brandSummary: 'productId=demo',
  skills: [] as MarketingSkill[],
  projectSummary: {
    id: '00000000-0000-4000-8000-000000000001',
    productId: 'demo',
    compositionId: 'talking-head-60',
    status: 'drafting',
    revision: 1,
    clipCount: 1,
    assetCount: 1,
    fps: 30,
    durationSeconds: 4.5,
    contentEndSeconds: 3,
    clips: [],
    headline: 'test',
  },
}

describe('buildSystemPrompt', () => {
  it('names the product Synawood (#1332)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'founder-edit' })
    expect(prompt).toMatch(/You are the Synawood Creative Studio Agent/)
    expect(prompt).not.toMatch(/Synawood/)
  })
  it('tells the agent image gen is enabled and to call generate_image on Gateway profiles', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'gemini-flash-image' })
    expect(prompt).toMatch(/Image generation is ENABLED/)
    expect(prompt).toMatch(/generate_image/)
    expect(prompt).toMatch(/add_clip/)
    expect(prompt).toMatch(/reasoner/)
    expect(prompt).toMatch(/shall I proceed/)
    expect(prompt).toMatch(/please wait/)
    expect(prompt).not.toMatch(/cannot touch the network/)
  })

  it('forbids generate_image of words as a fake title (#703)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'gemini-flash-image' })
    expect(prompt).toMatch(/add_text/)
    expect(prompt).toMatch(/place_sticker/)
    expect(prompt).toMatch(/apply_filter/)
    expect(prompt).toMatch(/apply_effect/)
    expect(prompt).toMatch(/regen_effect/)
    expect(prompt).toMatch(/thumbnail/)
    expect(prompt).toMatch(/list_library/)
    expect(prompt).toMatch(/create_library_item/)
    expect(prompt).toMatch(/import_library_item/)
    expect(prompt).toMatch(/Never generate_image of words/)
  })

  it('says duration auto-grows so placement past durationSeconds is allowed', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'gemini-flash-image' })
    expect(prompt).toMatch(/auto-grows/)
    expect(prompt).toMatch(/Never refuse "at Ns"/)
  })

  it('marks generation off on the kill-switch and does not teach Live clips', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'founder-edit' })
    expect(prompt).toMatch(/Image generation is off/)
    expect(prompt).toMatch(/Video generation is off/)
    expect(prompt).toMatch(/Do not fake an ad with stills/)
    expect(prompt).not.toMatch(/Live clips/)
    expect(prompt).not.toMatch(/\bA-roll\b/)
    expect(prompt).not.toMatch(/\bB-roll\b/)
    expect(prompt).not.toMatch(/talking head/i)
    expect(prompt).not.toMatch(
      /confirmSpend=true after stating the estimate — all in the same turn/,
    )
  })

  it('requires inspect_preview before the agent can say a video is done', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'founder-edit' })
    expect(prompt).toMatch(/inspect_preview/)
    expect(prompt).toMatch(/Do not narrate success/)
    expect(prompt).toMatch(/music bed/)
    expect(prompt).toMatch(/brand kit/)
  })

  it('injects Plan mode and motion craft (#1325 / #1326)', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'founder-edit',
      turnMode: 'plan',
      motionGraphics: true,
    })
    expect(prompt).toMatch(/TURN MODE: Plan/)
    expect(prompt).toMatch(/chat reply IS the deliverable/)
    expect(prompt).toMatch(/Do not pretend you made it/)
    expect(prompt).toMatch(/CRAFT: Motion graphics/)
    expect(prompt).not.toMatch(/TURN MODE: Execute/)
  })

  it('Inspect recommends after watch; Execute may plan and inspect (#1325)', () => {
    const inspect = buildSystemPrompt({
      ...base,
      modelProfileId: 'founder-edit',
      turnMode: 'inspect',
    })
    expect(inspect).toMatch(/TURN MODE: Inspect/)
    expect(inspect).toMatch(/change recommendations/)
    const execute = buildSystemPrompt({
      ...base,
      modelProfileId: 'founder-edit',
      turnMode: 'execute',
    })
    expect(execute).toMatch(/You may plan, inspect, and make the ad/)
    expect(execute).toMatch(/footer picker is binding/)
    expect(execute).toMatch(/If they only want a plan/)
  })

  it('asks for scannable markdown narration with Thoughts as the receipt channel', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'founder-edit' })
    expect(prompt).toMatch(/scannable markdown/)
    expect(prompt).toMatch(/collapsed Thoughts/)
    expect(prompt).toMatch(/no UUIDs/)
    expect(prompt).toMatch(/GitHub-flavored markdown table/)
    expect(prompt).not.toMatch(/appear separately as Activity/)
  })

  it('tells the agent spend is already confirmed this turn (#1328)', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'founder-edit',
      confirmSpend: true,
    })
    expect(prompt).toMatch(/already confirmed for this turn/)
    expect(prompt).toMatch(/Do not add a confirmSpend field to any tool call/)
    expect(prompt).not.toMatch(/Never pass confirmSpend on set_intent/)
    expect(prompt).toMatch(/Never say a confirmSpend parameter is required/)
  })

  it('tells motion craft to patch black frames instead of stills on MAIN (#1328)', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'founder-edit',
      motionGraphics: true,
    })
    expect(prompt).toMatch(/frames are black/)
    expect(prompt).toMatch(/write_composition or patch_composition/)
    expect(prompt).toMatch(/Do not generate_image or add_clip onto MAIN/)
  })

  it('requires generate_video_clip to fill an ad when video gen is on', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/Video generation is ENABLED/)
    expect(prompt).toMatch(/google\/veo-3\.1-fast-generate-001/)
    expect(prompt).toMatch(/max 8s per clip/)
    expect(prompt).toMatch(/generate_video_clip until moving picture covers/)
    expect(prompt).toMatch(/Do not tile still photos or the logo as the ad/)
    expect(prompt).toMatch(/Prefer sourceImageAssetId from a product photo/)
    expect(prompt).toMatch(/Do not substitute a still photo/)
    expect(prompt).toMatch(/two or more product stills/)
    expect(prompt).toMatch(/feeds the last MAIN clip/)
    expect(prompt).toMatch(/last frame/)
    expect(prompt).toMatch(/do not call generate_video_clip as text-to-video/)
    expect(prompt).toMatch(/snaps to this model/)
    expect(prompt).toMatch(/omit durationSeconds/)
    expect(prompt).toMatch(/Do not pass 8s for a 15s ad/)
  })

  it('names a Seedance override and its 30s clip cap', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'balanced',
      videoModelId: 'bytedance/seedance-2.5',
    })
    expect(prompt).toMatch(/bytedance\/seedance-2\.5/)
    expect(prompt).toMatch(/max 30s per clip/)
    expect(prompt).toMatch(/max 50 stills/)
    expect(prompt).toMatch(/max 50 video refs/)
    expect(prompt).toMatch(/Never silently drop a tagged @asset/)
    expect(prompt).toMatch(/before calling generate_video_clip/)
    expect(prompt).not.toMatch(/google\/veo-3\.1-fast-generate-001/)
  })

  it('names Seedance 2.0 Fast as a 15s clip, not Veo’s 8s', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'balanced',
      videoModelId: 'bytedance/seedance-2.0-fast',
    })
    expect(prompt).toMatch(/bytedance\/seedance-2\.0-fast/)
    expect(prompt).toMatch(/max 15s per clip/)
    expect(prompt).toMatch(/Do not pass 8s for a 15s ad/)
  })

  it('keeps Gateway image profiles video-off', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'gemini-flash-image' })
    expect(prompt).toMatch(/Image generation is ENABLED/)
    expect(prompt).toMatch(/Video generation is off/)
    expect(prompt).not.toMatch(/Video generation is ENABLED/)
  })

  it('maps end-screen images to add_clip not text overlays', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'gemini-pro-image' })
    expect(prompt).toMatch(/End screen/)
    expect(prompt).toMatch(/full-frame still/)
    expect(prompt).toMatch(/Do NOT call set_end_card for a photo end screen/)
  })

  it('forbids substituting unrelated assets when generate_image fails', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'gemini-flash-image' })
    expect(prompt).toMatch(/ok:false/)
    expect(prompt).toMatch(/unrelated existing asset/)
    expect(prompt).toMatch(/set_end_card/)
  })

  it('includes Intent/Scenes guidance and optional summary block', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'founder-edit',
      intentScenesSummary: [
        '## Intent and scenes',
        'INTENT',
        'goal: signup   platform: tiktok',
        '',
        'SCENES',
        'sc_001 hook (targetFrames 90) - Hook',
      ].join('\n'),
    })
    expect(prompt).toMatch(/Intent and scenes/)
    expect(prompt).toMatch(/direct_project/)
    expect(prompt).toMatch(/commit_director_plan/)
    expect(prompt).toMatch(/never silently rebuild/)
    expect(prompt).toMatch(/set_intent/)
    expect(prompt).toMatch(/plan_scenes/)
    expect(prompt).toMatch(/awarenessStage/)
    expect(prompt).toMatch(/Do not write the same headline for every stage/)
    expect(prompt).toMatch(/primaryMessage/)
    expect(prompt).toMatch(/Fast! Easy! AI-powered!/)
    expect(prompt).toMatch(/do not invent a second CTA field/)
    expect(prompt).toMatch(/goal: signup/)
    expect(prompt).toMatch(/sc_001 hook/)
  })

  it('locks wardrobe across clips and tells the agent to retime overlays (#577, #597)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/same person, outfit, product/)
    expect(prompt).toMatch(/Do not mix wardrobe/)
    expect(prompt).toMatch(/end card/)
    expect(prompt).toMatch(/place_overlay/)
  })

  it('forbids still padding and asking the founder after a failing inspect (#601)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/Do not pad MAIN with still photos/)
    expect(prompt).toMatch(/do not ask the founder what to do/)
    expect(prompt).toMatch(/remaining brief/)
  })

  it('requires library Moments before generate and forbids Generator MP4 as Final (#526)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/find_moments first/)
    expect(prompt).toMatch(/imageAssetId/)
    expect(prompt).toMatch(/analyze_asset/)
    expect(prompt).toMatch(/kind=compliance/)
    expect(prompt).toMatch(/not a hard block/)
    expect(prompt).toMatch(/never marks cut review passed/)
    expect(prompt).toMatch(/inspect_preview/)
    expect(prompt).toMatch(/sceneRole/)
    expect(prompt).toMatch(/visual\+text/)
    expect(prompt).toMatch(/Do not call generate_video_clip first/)
    expect(prompt).toMatch(/Never ship a Generator MP4 as Final/)
    expect(prompt).not.toMatch(/\bB-roll\b/)
  })

  it('commits overlay plans itself with no Picture plan screen (#638)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/assemble_broll then commit_broll_plan in the same turn/)
    expect(prompt).toMatch(/no founder Picture plan screen/)
    expect(prompt).toMatch(/confirmSpend=true/)
  })

  it('tells the agent Voice Studio defaults to a ready clone (#762)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'founder-edit' })
    expect(prompt).toMatch(/latest ready clone/)
    expect(prompt).toMatch(/recorded sample plus consent/)
    expect(prompt).toMatch(/Settings → Voice/)
  })

  it('instructs the agent to use Grounding ids with existing tools (#877)', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'balanced',
      groundingReferences: '## Grounding (this turn)\n- clipId=clip_aaaaaaaa',
    })
    expect(prompt).toMatch(/Grounding \(this turn\)/)
    expect(prompt).toMatch(/clipId=clip_aaaaaaaa/)
    expect(prompt).toMatch(/still call a tool/)
    expect(prompt).toMatch(/Do not invent clip or overlay ids/)
    expect(prompt).toMatch(/enhance_speech/)
    expect(prompt).toMatch(/reframe_clip/)
    expect(prompt).toMatch(/duck_music/)
    expect(prompt).toMatch(/place_sfx/)
    expect(prompt).toMatch(/apply_motion_preset/)
    expect(prompt).toMatch(/set_caption_style/)
  })

  it('encodes talking-head first-pass order and forbids a named recipe (#886)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(
      /enhance_speech[\s\S]*build_cut_list[\s\S]*apply_cut_list[\s\S]*apply_jump_cut_zooms[\s\S]*captions_from_transcript[\s\S]*set_caption_style[\s\S]*generate_music[\s\S]*duck_music[\s\S]*place_sfx[\s\S]*apply_motion_preset[\s\S]*import_product_brand[\s\S]*inspect_preview/,
    )
    expect(prompt).toMatch(/Skip any step that already applies/)
    expect(prompt).toMatch(/why-log/)
    expect(prompt).not.toMatch(/Producer/)
    expect(prompt).not.toMatch(/Quick Design/)
  })

  it('encodes motion-graphics first-pass and forbids talking-head fallback (#1196)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/write_composition/)
    expect(prompt).toMatch(/list_motion_kit/)
    expect(prompt).toMatch(/patch_composition/)
    expect(prompt).toMatch(/snappy/)
    expect(prompt).toMatch(/Never switch to talking-head-60/)
    expect(prompt).toMatch(/static centered type/)
    expect(prompt).toMatch(/generate_voiceover/)
    expect(prompt).toMatch(/Do not narrate a warm-female speaker/)
  })

  it('names the kit import and forbids guessed aliases (#1261)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/@synawood\/creative\/motion-kit/)
    expect(prompt).toMatch(/@motion-kit/)
    expect(prompt).toMatch(/@remotion\/motion-kit/)
  })

  it('forbids generate_image and add_clip as the picture on authored fails (#1263)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/On an authored project/)
    expect(prompt).toMatch(/never generate_image or add_clip/)
    expect(prompt).toMatch(/hex colors/)
  })

  it('requires CountUp on the first split-stat write, not a later patch (#1257)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/split-stat/)
    expect(prompt).toMatch(/CountUp/)
    expect(prompt).toMatch(/first write_composition/)
    expect(prompt).toMatch(/Sequence/)
    expect(prompt).toMatch(/opacity 0 on frame 0/)
    expect(prompt).toMatch(/logoUrl/)
    expect(prompt).toMatch(/productUrl/)
    expect(prompt).toMatch(/Last Sequence must cover durationFrames/)
    expect(prompt).toMatch(/CountUp is value=\{n\}/)
    expect(prompt).toMatch(/Never staticFile/)
    expect(prompt).toMatch(/Do not invent keys like bgHook/)
    expect(prompt).toMatch(/CountUp belongs inside the Sequence beat/)
    expect(prompt).toMatch(/plates\[i\]\.src also works/)
    expect(prompt).toMatch(/extrapolateRight: 'clamp'/)
  })

  it('requires find_moments before generate_image on motion when shots exist (#1198)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/call find_moments before generate_image/)
    expect(prompt).toMatch(/Empty index → generate_image with confirmSpend is allowed/)
    expect(prompt).toMatch(/never live-site hotlinks/)
  })

  it('puts carousels on this player and forbids lazy color fills (#1010, #1011)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/plan_slideshow on this project/)
    expect(prompt).toMatch(/generate_slide_background/)
    expect(prompt).toMatch(/generate_music/)
    expect(prompt).toMatch(/inspect_preview/)
    expect(prompt).toMatch(/Open link/)
    expect(prompt).not.toMatch(/create_project on THIS project/)
  })

  it('names stacked and split compartment layouts beside overlay (#1017)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/stack_media_top/)
    expect(prompt).toMatch(/stack_type_top/)
    expect(prompt).toMatch(/split_media_left/)
    expect(prompt).toMatch(/split_media_right/)
    expect(prompt).toMatch(/overlay/)
  })

  it('prefers Product Extracts as generate refs and keeps DNA Apply explicit (#1098)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/sourceImageAssetIds or slide backgrounds/)
    expect(prompt).toMatch(/unless those ids were passed/)
    expect(prompt).toMatch(/Brand Studio Apply stays explicit/)
  })

  it('injects Product Extracts when present and stays unchanged when empty (#1097)', () => {
    const empty = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(empty).not.toMatch(/## Product Extracts/)
    const withExtracts = buildSystemPrompt({
      ...base,
      modelProfileId: 'balanced',
      productExtracts: [
        '## Product Extracts (this Product)',
        '- extractId=11111111-1111-4111-8111-111111111111 quality=usable',
      ].join('\n'),
    })
    expect(withExtracts).toMatch(/11111111-1111-4111-8111-111111111111/)
    expect(withExtracts).not.toMatch(/quality=reject/)
  })

  it('injects a Motion scene plan when present and stays unchanged when empty (#1200)', () => {
    const empty = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(empty).not.toMatch(/## Motion scene plan/)
    const withPlan = buildSystemPrompt({
      ...base,
      modelProfileId: 'balanced',
      motionScenePlan: [
        '## Motion scene plan',
        '- kind=device-hero shotId=11111111-1111-4111-8111-111111111111',
      ].join('\n'),
    })
    expect(withPlan).toMatch(/11111111-1111-4111-8111-111111111111/)
    expect(withPlan).toMatch(/device-hero/)
  })

  it('tells the agent to write Sequences from analyze highlights (#1200)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/Motion scene plan/)
    expect(prompt).toMatch(/type-led/)
    expect(prompt).toMatch(/analyze_asset never marks cut review passed/)
  })

  it('choreographs motion Sequences from creativeStructure beats (#1201)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/write Sequences from those beats/)
    expect(prompt).toMatch(/one-scene type-led fallback/)
    expect(prompt).toMatch(/Do not add a second empty-beats pill/)
    expect(prompt).not.toMatch(/[Nn]eo4j/)
  })

  it('routes product-page extract URLs to extract_product_pages (#1365)', () => {
    const prompt = buildSystemPrompt({ ...base, modelProfileId: 'balanced' })
    expect(prompt).toMatch(/extract_product_pages/)
    expect(prompt).toMatch(/Extracts bin/)
    expect(prompt).not.toMatch(/cannot browse arbitrary URLs/)
  })

  it('tells the agent to remove or trim timeline audio when asked (#1372)', () => {
    const prompt = buildSystemPrompt({
      ...base,
      modelProfileId: 'balanced',
      motionGraphics: true,
    })
    expect(prompt).toMatch(/remove_clip or trim_clip/)
    expect(prompt).toMatch(/do not refuse because MAIN is empty/)
    expect(prompt).toMatch(/unsolicited just to/)
  })
})
