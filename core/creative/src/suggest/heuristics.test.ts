import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { addClip, attachAsset, packClips } from '../project/operations'
import { addSceneOnProject, setIntentOnProject } from '../intent/mutations'
import { dedupeSuggestions, suggestForClipHeuristic, suggestForSceneHeuristic } from './heuristics'
import { buildClipSuggestions } from './index'
import { clearSuggestionCache } from './reasoner'

const baseProject = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  project = attachAsset(project, {
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'video',
    blobKey: 'local/a.mp4',
    source: 'upload',
    probe: { durationFrames: 180 },
  })
  project = addClip(project, {
    assetId: '11111111-1111-4111-8111-111111111111',
    from: 0,
    durationInFrames: 180,
  })
  project = attachAsset(project, {
    id: '11111111-1111-4111-8111-111111111112',
    kind: 'video',
    blobKey: 'local/b.mp4',
    source: 'upload',
    probe: { durationFrames: 60 },
  })
  project = addClip(project, {
    assetId: '11111111-1111-4111-8111-111111111112',
    from: 200,
    durationInFrames: 60,
  })
  project = setIntentOnProject(project, { cta: 'Try the private example', emotion: 'urgent' })
  return project
}

describe('suggestForClipHeuristic', () => {
  it('suggests shorten, captions, split, and pack for a long video clip', () => {
    const project = baseProject()
    const clipId = project.clips[0]!.id
    const suggestions = suggestForClipHeuristic(project, clipId)
    const tools = suggestions.map((s) => s.tool)
    expect(tools).toContain('trim_clip')
    expect(tools).toContain('add_captions')
    expect(tools).toContain('split_clip')
    expect(tools).toContain('pack_clips')
    expect(suggestions.every((s) => s.estimatedCostGbp === 0)).toBe(true)
  })

  it('does not open a Picture plan from clip suggestions (#638)', () => {
    const project = baseProject()
    const clipId = project.clips[0]!.id
    const suggestions = suggestForClipHeuristic(project, clipId)
    expect(suggestions.some((s) => s.tool === 'assemble_broll')).toBe(false)
    expect(suggestions.some((s) => s.tool === 'generate_video_clip')).toBe(false)
  })

  it('suggests assign when scenes exist but clip is unassigned', () => {
    let project = baseProject()
    project = addSceneOnProject(project, { role: 'hook', label: 'Hook' })
    const clipId = project.clips[0]!.id
    const suggestions = suggestForClipHeuristic(project, clipId)
    expect(suggestions.some((s) => s.tool === 'assign_clip_to_scene')).toBe(true)
  })

  it('does not suggest pack when the video track already has no gaps', () => {
    const project = packClips(baseProject())
    const clipId = project.clips[0]!.id
    const suggestions = suggestForClipHeuristic(project, clipId)
    expect(suggestions.some((s) => s.tool === 'pack_clips')).toBe(false)
  })
})

describe('suggestForSceneHeuristic', () => {
  it('returns scene-scoped free suggestions', () => {
    let project = baseProject()
    const clipA = project.clips[0]!.id
    const clipB = project.clips[1]!.id
    project = addSceneOnProject(project, {
      role: 'cta',
      label: 'CTA',
      clipIds: [clipA, clipB],
    })
    const sceneId = project.scenes[0]!.id
    const suggestions = suggestForSceneHeuristic(project, sceneId)
    expect(suggestions.some((s) => s.tool === 'pack_clips')).toBe(true)
    expect(suggestions.some((s) => s.tool === 'set_end_card')).toBe(true)
  })
})

describe('buildClipSuggestions', () => {
  it('returns heuristics under mock profile without reasoner rows', async () => {
    clearSuggestionCache()
    const project = baseProject()
    const result = await buildClipSuggestions(project, project.clips[0]!.id, {
      modelProfileId: 'ci-stub',
    })
    expect(result.sources.heuristic).toBeGreaterThan(0)
    expect(result.sources.reasoner).toBe(0)
    expect(dedupeSuggestions(result.suggestions).length).toBe(result.suggestions.length)
  })
})
