import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { addClip, attachAsset } from '../project/operations'
import {
  addSceneOnProject,
  assignClipToSceneOnProject,
  mergeIntent,
  planScenesHeuristic,
  pruneMissingSceneClipRefs,
  removeSceneOnProject,
  reorderScenesOnProject,
  setIntentOnProject,
  setSceneOnProject,
} from './mutations'
import { deriveCtaFromIntent } from './cta-from-behaviour'

const projectWithClips = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  const assetA = '11111111-1111-4111-8111-111111111111'
  const assetB = '11111111-1111-4111-8111-111111111112'
  const assetC = '11111111-1111-4111-8111-111111111113'
  const assetD = '11111111-1111-4111-8111-111111111114'
  for (const [id, from] of [
    [assetA, 0],
    [assetB, 90],
    [assetC, 180],
    [assetD, 270],
  ] as const) {
    project = attachAsset(project, {
      id,
      kind: 'video',
      blobKey: `local/${id}.mp4`,
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, { assetId: id, from })
  }
  return project
}

describe('mergeIntent / setIntentOnProject', () => {
  it('merges patches and preserves keywords when omitted', () => {
    const intent = mergeIntent(
      { keywords: ['a'], goal: 'awareness' },
      { emotion: 'emotional', platform: 'tiktok' },
    )
    expect(intent).toMatchObject({
      goal: 'awareness',
      emotion: 'emotional',
      platform: 'tiktok',
      keywords: ['a'],
    })
  })

  it('writes intent onto the project', () => {
    const project = setIntentOnProject(
      createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
      }),
      { cta: 'Download today', lengthSeconds: 15 },
    )
    expect(project.intent.cta).toBe('Download today')
    expect(project.intent.lengthSeconds).toBe(15)
  })

  it('derives cta from desiredBehaviour when cta is omitted (#1220)', () => {
    const intent = mergeIntent({ keywords: [] }, { desiredBehaviour: 'start a 14-day trial' })
    expect(intent.cta).toMatch(/trial/i)
    expect(intent.cta).not.toMatch(/learn more/i)
  })

  it('keeps an explicit cta when desiredBehaviour is also set (#1220)', () => {
    const intent = mergeIntent(
      { keywords: [] },
      { desiredBehaviour: 'start a 14-day trial', cta: 'Get the private example free' },
    )
    expect(intent.cta).toBe('Get the private example free')
  })

  it('does not overwrite an existing cta when patch omits cta (#1220)', () => {
    const intent = mergeIntent(
      { keywords: [], cta: 'Download today' },
      { desiredBehaviour: 'book a demo' },
    )
    expect(intent.cta).toBe('Download today')
  })

  it('ignores surplus confirmSpend on a patch (#1328)', () => {
    const intent = mergeIntent({ keywords: [] }, { emotion: 'urgent', confirmSpend: true } as never)
    expect(intent.emotion).toBe('urgent')
    expect(intent).not.toHaveProperty('confirmSpend')
  })

  it('maps behaviour keywords to default CTAs (#1220)', () => {
    expect(deriveCtaFromIntent({ desiredBehaviour: 'book a product demo' })).toBe('Book a demo')
    expect(deriveCtaFromIntent({ desiredBehaviour: 'install the app' })).toBe('Install')
    expect(deriveCtaFromIntent({ desiredBehaviour: 'add to shortlist' })).toBe('Add to shortlist')
    expect(deriveCtaFromIntent({ goal: 'signup' })).toBe('Sign up')
  })
})

describe('scene CRUD + assign', () => {
  it('adds, updates, reorders, and removes scenes', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = addSceneOnProject(project, { role: 'hook', label: 'Hook' })
    project = addSceneOnProject(project, { role: 'cta', label: 'CTA' })
    expect(project.scenes).toHaveLength(2)

    const hookId = project.scenes[0]!.id
    project = setSceneOnProject(project, { sceneId: hookId, label: 'Hook v2', locked: true })
    expect(project.scenes[0]?.label).toBe('Hook v2')
    expect(project.scenes[0]?.locked).toBe(true)

    const ctaId = project.scenes[1]!.id
    project = reorderScenesOnProject(project, [ctaId, hookId])
    expect(project.scenes.map((s) => s.id)).toEqual([ctaId, hookId])

    project = removeSceneOnProject(project, ctaId)
    expect(project.scenes).toHaveLength(1)
    expect(project.scenes[0]?.id).toBe(hookId)
  })

  it('assigns a clip to one scene only', () => {
    let project = projectWithClips()
    project = addSceneOnProject(project, { role: 'hook', label: 'Hook' })
    project = addSceneOnProject(project, { role: 'cta', label: 'CTA' })
    const clipId = project.clips[0]!.id
    const [hook, cta] = project.scenes
    project = assignClipToSceneOnProject(project, { clipId, sceneId: hook!.id })
    project = assignClipToSceneOnProject(project, { clipId, sceneId: cta!.id })
    expect(project.scenes.find((s) => s.id === hook!.id)?.clipIds).toEqual([])
    expect(project.scenes.find((s) => s.id === cta!.id)?.clipIds).toEqual([clipId])

    project = assignClipToSceneOnProject(project, { clipId, sceneId: null })
    expect(project.scenes.every((s) => s.clipIds.length === 0)).toBe(true)
  })

  it('rejects assigning an unknown clip', () => {
    const project = addSceneOnProject(
      createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
      }),
      { role: 'hook', label: 'Hook' },
    )
    expect(() =>
      assignClipToSceneOnProject(project, {
        clipId: 'missing',
        sceneId: project.scenes[0]!.id,
      }),
    ).toThrow(/Unknown clip/)
  })
})

describe('planScenesHeuristic', () => {
  it('drafts a four-beat skeleton when there are no clips', () => {
    const project = setIntentOnProject(
      createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
      }),
      { cta: 'Try the private example', lengthSeconds: 16 },
    )
    const plan = planScenesHeuristic(project)
    expect(plan.scenes.map((s) => s.role)).toEqual(['hook', 'problem', 'solution', 'cta'])
    expect(plan.scenes.every((s) => s.clipIds.length === 0)).toBe(true)
    expect(plan.scenes[3]?.label).toContain('Try the private example')
  })

  it('buckets timeline clips across story beats in order', () => {
    const project = setIntentOnProject(projectWithClips(), { platform: 'tiktok' })
    const plan = planScenesHeuristic(project, { preserveClipOrder: true })
    expect(plan.scenes).toHaveLength(4)
    const assigned = plan.scenes.flatMap((s) => s.clipIds)
    expect(assigned).toHaveLength(4)
    expect(new Set(assigned).size).toBe(4)
    expect(plan.scenes[0]?.role).toBe('hook')
    expect(plan.scenes[3]?.role).toBe('cta')
  })
})

describe('pruneMissingSceneClipRefs', () => {
  it('drops clip ids after media is gone', () => {
    let project = projectWithClips()
    const clipId = project.clips[0]!.id
    project = addSceneOnProject(project, {
      role: 'hook',
      label: 'Hook',
      clipIds: [clipId],
    })
    project = { ...project, clips: project.clips.slice(1) }
    project = pruneMissingSceneClipRefs(project)
    expect(project.scenes[0]?.clipIds).toEqual([])
  })
})
