import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { addClip, attachAsset, setEndCard } from '../project/operations'
import {
  setIntentOnProject,
  addSceneOnProject,
  assignClipToSceneOnProject,
} from '../intent/mutations'
import {
  applyDirectorPlanEdits,
  buildDirectorPrompt,
  buildHeuristicDirectorPlan,
  directorPlanFromReasonerPayload,
  hashDirectProjectInput,
  markPlanStaleIfNeeded,
  mergeHeuristicWhenReasonerEmpty,
  parseReasonerDirectorPayload,
} from './plan'

const projectWithClips = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  const assets = [
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111112',
  ] as const
  let from = 0
  for (const id of assets) {
    project = attachAsset(project, {
      id,
      kind: 'video',
      blobKey: `local/${id}.mp4`,
      source: 'upload',
      probe: { durationFrames: 120 },
    })
    project = addClip(project, { assetId: id, from, durationInFrames: 120 })
    from += 150
  }
  project = setEndCard(project, 'Try the private example')
  project = setIntentOnProject(project, {
    emotion: 'urgent',
    cta: 'Try the private example',
    lengthSeconds: 8,
  })
  return project
}

describe('buildHeuristicDirectorPlan', () => {
  it('proposes pack + trim for urgent intent without mutating the project', () => {
    const project = projectWithClips()
    const before = JSON.stringify(project)
    const plan = buildHeuristicDirectorPlan(
      project,
      { style: 'urgent' },
      { id: '33333333-3333-4333-8333-333333333333', reasonerModelId: 'mock-reasoner' },
    )
    expect(JSON.stringify(project)).toBe(before)
    expect(plan.status).toBe('draft')
    expect(plan.edits.some((e) => e.mutation.type === 'pack_clips')).toBe(true)
    expect(plan.edits.some((e) => e.mutation.type === 'trim_clip')).toBe(true)
    expect(plan.costEstimateGbp).toBe(0)
  })

  it('maps free-text style onto vibe pacing (not only exact ids)', () => {
    let project = projectWithClips()
    project = setIntentOnProject(project, { emotion: 'calm' })
    const plan = buildHeuristicDirectorPlan(
      project,
      { style: 'viral launch hype' },
      { id: '33333333-3333-4333-8333-333333333337', reasonerModelId: 'mock-reasoner' },
    )
    expect(plan.edits.some((e) => e.mutation.type === 'trim_clip')).toBe(true)
  })

  it('energetic talking-head rebuild proposes ≥2 applyable edits', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      compositionId: 'talking-head-60',
    })
    project = attachAsset(project, {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'video',
      blobKey: 'local/talk.mp4',
      source: 'upload',
      probe: { durationFrames: 300 },
    })
    project = addClip(project, {
      assetId: '11111111-1111-4111-8111-111111111111',
      from: 0,
      durationInFrames: 300,
    })
    project = setIntentOnProject(project, {
      platform: 'tiktok',
      emotion: 'exciting',
      cta: 'Try the private example',
      keywords: ['Stop scrolling'],
    })
    const plan = buildHeuristicDirectorPlan(
      project,
      { style: 'energetic' },
      { id: '33333333-3333-4333-8333-333333333350', reasonerModelId: 'mock-reasoner' },
    )
    const proposed = plan.edits.filter((edit) => edit.status === 'proposed')
    expect(proposed.length).toBeGreaterThanOrEqual(2)
    const applied = applyDirectorPlanEdits(project, plan)
    expect(applied.appliedIds.length).toBeGreaterThanOrEqual(2)
    expect(applied.skippedIds.filter((id) => proposed.some((edit) => edit.id === id))).toEqual([])
    expect(
      applied.project.overlays.some(
        (overlay) => overlay.kind === 'hook_title' || overlay.kind === 'caption',
      ),
    ).toBe(true)
  })

  it('skips locked-scene clips unless explicitly scoped', () => {
    let project = projectWithClips()
    const clipId = project.clips[0]!.id
    project = addSceneOnProject(project, {
      role: 'hook',
      label: 'Hook',
      locked: true,
      clipIds: [clipId],
    })
    const plan = buildHeuristicDirectorPlan(
      project,
      {},
      { id: '33333333-3333-4333-8333-333333333334', reasonerModelId: 'mock-reasoner' },
    )
    const trimForLocked = plan.edits.find(
      (e) =>
        e.mutation.type === 'trim_clip' && (e.mutation as { clipId?: string }).clipId === clipId,
    )
    expect(trimForLocked).toBeUndefined()
  })
})

describe('applyDirectorPlanEdits', () => {
  it('applies proposed edits and honors excludes', () => {
    const project = projectWithClips()
    const plan = buildHeuristicDirectorPlan(
      project,
      { style: 'urgent' },
      { id: '33333333-3333-4333-8333-333333333335', reasonerModelId: 'mock-reasoner' },
    )
    const packId = plan.edits.find((e) => e.mutation.type === 'pack_clips')?.id
    expect(packId).toBeTruthy()
    const applied = applyDirectorPlanEdits(project, plan, [packId!])
    expect(applied.skippedIds).toContain(packId)
    expect(applied.appliedIds.length).toBeGreaterThan(0)
    expect(applied.project.revision).toBeGreaterThan(project.revision)
  })

  it('packs the main picture track when the reasoner stuffed a scene id into trackId (#637)', () => {
    let project = projectWithClips()
    project = addSceneOnProject(project, {
      role: 'hook',
      label: 'Hook',
      clipIds: [project.clips[0]!.id],
    })
    const sceneId = project.scenes[0]!.id
    expect(sceneId.startsWith('sc_')).toBe(true)
    const plan = directorPlanFromReasonerPayload(
      project,
      {},
      {
        rationale: 'Pack the hook',
        edits: [
          {
            mutation: { type: 'pack_clips', trackId: sceneId },
            previewText: 'Pack clips for hook',
            sceneId,
          },
          {
            mutation: { type: 'set_end_card', text: 'Shop Okiki' },
            previewText: 'Set CTA',
          },
        ],
      },
      { id: '33333333-3333-4333-8333-333333333350', reasonerModelId: 'test-reasoner' },
    )
    const applied = applyDirectorPlanEdits(project, plan)
    expect(applied.appliedIds.length).toBeGreaterThan(0)
    expect(applied.project.overlays.some((overlay) => overlay.kind === 'end_card')).toBe(true)
  })

  it('skips a throwing edit and still applies the rest (#637)', () => {
    const project = projectWithClips()
    const plan = directorPlanFromReasonerPayload(
      project,
      {},
      {
        rationale: 'Mix',
        edits: [
          {
            mutation: { type: 'trim_clip', clipId: 'clip_missing', durationInFrames: 30 },
            previewText: 'Trim a clip that does not exist',
          },
          {
            mutation: { type: 'set_hook_title', text: 'Stop scrolling' },
            previewText: 'Hook',
          },
        ],
      },
      { id: '33333333-3333-4333-8333-333333333351', reasonerModelId: 'test-reasoner' },
    )
    expect(() => applyDirectorPlanEdits(project, plan)).not.toThrow()
    const applied = applyDirectorPlanEdits(project, plan)
    expect(applied.project.overlays.some((overlay) => overlay.kind === 'hook_title')).toBe(true)
  })
})

describe('parseReasonerDirectorPayload / stale', () => {
  it('parses fenced JSON', () => {
    const payload = parseReasonerDirectorPayload(
      '```json\n{"rationale":"Tighten","edits":[{"mutation":{"type":"pack_clips"},"previewText":"pack"}]}\n```',
    )
    expect(payload?.rationale).toBe('Tighten')
    expect(payload?.edits?.[0]?.mutation.type).toBe('pack_clips')
  })

  it('marks draft plans stale when revision advances', () => {
    const project = projectWithClips()
    const plan = buildHeuristicDirectorPlan(
      project,
      {},
      { id: '33333333-3333-4333-8333-333333333336', reasonerModelId: 'mock-reasoner' },
    )
    expect(markPlanStaleIfNeeded(plan, project.revision + 1).status).toBe('stale')
    expect(markPlanStaleIfNeeded(plan, project.revision).status).toBe('draft')
  })

  it('hashes inputs stably', () => {
    const a = hashDirectProjectInput('p', 1, { style: 'premium' })
    const b = hashDirectProjectInput('p', 1, { style: 'premium' })
    const c = hashDirectProjectInput('p', 1, { style: 'urgent' })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('injects specialist vibe pack into the reasoner prompt', () => {
    const project = projectWithClips()
    const prompt = buildDirectorPrompt(
      project,
      { style: 'premium' },
      '## Specialist pack: director-vibes/premium',
    )
    expect(prompt).toContain('director-vibes/premium')
    expect(prompt).toContain('style: premium')
    expect(prompt).toContain('set_hook_title')
    expect(prompt).toContain('add_captions')
    expect(prompt).toContain('add_text')
    expect(prompt).toContain('update_overlay')
  })
})

describe('directorPlanFromReasonerPayload', () => {
  it('rejects malformed mutations with a readable reason', () => {
    const project = projectWithClips()
    const plan = directorPlanFromReasonerPayload(
      project,
      {},
      {
        rationale: 'Try punchier copy',
        edits: [
          {
            mutation: { type: 'trim_clip', durationInFrames: 60 },
            previewText: 'Shorten the hook',
          },
          {
            mutation: { type: 'invent_overlay', text: 'Nope' },
            previewText: 'Mystery tool',
          },
        ],
      },
      { id: '33333333-3333-4333-8333-333333333340', reasonerModelId: 'test-reasoner' },
    )
    expect(plan.edits).toHaveLength(2)
    expect(plan.edits.every((edit) => edit.status === 'rejected')).toBe(true)
    expect(plan.edits[0]?.rejectReason).toMatch(/missing clipId/i)
    expect(plan.edits[1]?.rejectReason).toMatch(/unsupported mutation type|invalid shape/i)
  })

  it('accepts set_hook_title / set_end_card / add_captions / add_text allowlist mutations', () => {
    const project = projectWithClips()
    const plan = directorPlanFromReasonerPayload(
      project,
      {},
      {
        rationale: 'Energetic punch-up',
        edits: [
          { mutation: { type: 'set_hook_title', text: 'Stop scrolling' }, previewText: 'Hook' },
          { mutation: { type: 'set_end_card', text: 'Try the private example today' }, previewText: 'CTA' },
          {
            mutation: { type: 'add_captions', text: 'One tip', from: 0, durationInFrames: 60 },
            previewText: 'Captions',
          },
          {
            mutation: { type: 'add_text', text: 'Free title', kind: 'title' },
            previewText: 'Title',
          },
        ],
      },
      { id: '33333333-3333-4333-8333-333333333341', reasonerModelId: 'test-reasoner' },
    )
    expect(plan.edits).toHaveLength(4)
    expect(plan.edits.every((edit) => edit.status === 'proposed')).toBe(true)
    const applied = applyDirectorPlanEdits(project, plan)
    expect(applied.appliedIds).toHaveLength(4)
    expect(applied.project.overlays.some((o) => o.kind === 'hook_title')).toBe(true)
    expect(applied.project.overlays.some((o) => o.kind === 'caption')).toBe(true)
    expect(applied.project.overlays.some((o) => o.kind === 'title')).toBe(true)
  })

  it('merges heuristic edits when the reasoner only returned rejects', () => {
    const project = projectWithClips()
    const reasonerPlan = directorPlanFromReasonerPayload(
      project,
      { style: 'urgent' },
      {
        edits: [{ mutation: { type: 'trim_clip', durationInFrames: 40 }, previewText: 'Oops' }],
      },
      { id: '33333333-3333-4333-8333-333333333342', reasonerModelId: 'test-reasoner' },
    )
    const heuristic = buildHeuristicDirectorPlan(
      project,
      { style: 'urgent' },
      { id: '33333333-3333-4333-8333-333333333343', reasonerModelId: 'test-reasoner' },
    )
    const merged = mergeHeuristicWhenReasonerEmpty(reasonerPlan, heuristic)
    expect(merged.edits.some((edit) => edit.status === 'rejected')).toBe(true)
    expect(merged.edits.filter((edit) => edit.status === 'proposed').length).toBeGreaterThan(0)
    expect(merged.rationale).toMatch(/failed validation/i)
  })
})

describe('assign helper smoke', () => {
  it('keeps assignClipToSceneOnProject import used for locked-scene setup', () => {
    let project = projectWithClips()
    project = addSceneOnProject(project, { role: 'cta', label: 'CTA' })
    project = assignClipToSceneOnProject(project, {
      clipId: project.clips[0]!.id,
      sceneId: project.scenes[0]!.id,
    })
    expect(project.scenes[0]?.clipIds).toHaveLength(1)
  })
})
