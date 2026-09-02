import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { addClip, attachAsset } from '../project/operations'
import { buildDirectorPlan } from './build'

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
  return project
}

describe('buildDirectorPlan', () => {
  it('loads director-vibes and surfaces mapped free-text style', async () => {
    const { plan, source, vibeId } = await buildDirectorPlan(
      projectWithClips(),
      { style: 'quiet luxury polish' },
      { modelProfileId: 'ci-stub' },
    )
    expect(source).toBe('heuristic')
    expect(vibeId).toBe('premium')
    expect(plan.rationale).toMatch(/mapped to premium/i)
  })

  it('keeps mock / ci-stub on the heuristic routing path (no live reasoner)', async () => {
    const { source, plan } = await buildDirectorPlan(
      projectWithClips(),
      { style: 'energetic' },
      { modelProfileId: 'ci-stub' },
    )
    expect(source).toBe('heuristic')
    expect(plan.reasonerModelId).toBe('mock-reasoner')
    expect(
      plan.edits.every((edit) => edit.status === 'proposed' || edit.status === 'rejected'),
    ).toBe(true)
  })

  it('mentions a mapped style pack in rationale without applying it', async () => {
    const project = projectWithClips()
    const { plan } = await buildDirectorPlan(
      project,
      { style: 'make it VHS' },
      { modelProfileId: 'ci-stub' },
    )
    expect(plan.rationale).toMatch(/vhs/i)
    expect(project.stylePackId ?? null).toBeNull()
  })
})
