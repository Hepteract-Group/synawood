import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createEmptyProject } from '../project/schema'
import {
  addSceneOnProject,
  deriveCreativeStructureOnProject,
  setCreativeStructureOnProject,
} from './mutations'
import { shouldBackfillCreativeStructure } from './backfill'
import {
  beatKindFromSceneRole,
  deriveCreativeStructure,
  emptyCreativeStructure,
} from './creative-structure'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0031_creative_structure.sql'),
  'utf8',
)
const snapshotSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0032_creative_structure_snapshot.sql'),
  'utf8',
)

describe('creativeStructure (#228–#236)', () => {
  it('defaults empty beats on new projects', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    expect(project.creativeStructure).toEqual(emptyCreativeStructure())
  })

  it('adds generated columns from project_json', () => {
    expect(migrationSql).toContain("generated always as (project_json -> 'creativeStructure')")
    expect(migrationSql).toContain('creative_structure_source')
  })

  it('maps scene roles onto beat kinds and skips custom', () => {
    expect(beatKindFromSceneRole('hook')).toBe('hook')
    expect(beatKindFromSceneRole('problem')).toBe('education')
    expect(beatKindFromSceneRole('context')).toBe('education')
    expect(beatKindFromSceneRole('proof')).toBe('trust')
    expect(beatKindFromSceneRole('solution')).toBe('offer')
    expect(beatKindFromSceneRole('offer')).toBe('offer')
    expect(beatKindFromSceneRole('cta')).toBe('cta')
    expect(beatKindFromSceneRole('custom')).toBeNull()
  })

  it('derives beats from scene clips (#229)', () => {
    const structure = deriveCreativeStructure({
      now: '2026-08-17T09:00:00.000Z',
      scenes: [
        { id: 'sc_hook', role: 'hook', clipIds: ['c1'] },
        { id: 'sc_skip', role: 'custom', clipIds: ['c2'] },
        { id: 'sc_cta', role: 'cta', clipIds: ['c3'] },
      ],
      clips: [
        { id: 'c1', from: 0, durationInFrames: 45 },
        { id: 'c2', from: 45, durationInFrames: 90 },
        { id: 'c3', from: 135, durationInFrames: 30 },
      ],
    })
    expect(structure.source).toBe('intent_scenes')
    expect(structure.beats).toEqual([
      { kind: 'hook', from: 0, durationInFrames: 45, sceneId: 'sc_hook' },
      { kind: 'cta', from: 135, durationInFrames: 30, sceneId: 'sc_cta' },
    ])
  })

  it('uses targetDurationFrames when a scene has no clips', () => {
    const structure = deriveCreativeStructure({
      now: '2026-08-17T09:00:00.000Z',
      scenes: [{ id: 'sc_h', role: 'hook', clipIds: [], targetDurationFrames: 60 }],
      clips: [],
    })
    expect(structure.beats[0]).toMatchObject({ kind: 'hook', from: 0, durationInFrames: 60 })
  })

  it('snapshots final_assets.creative_structure in SQL (#231)', () => {
    expect(snapshotSql).toContain('final_assets')
    expect(snapshotSql).toContain('creative_structure')
  })

  it('derive on a project with scenes increments revision', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = addSceneOnProject(project, { role: 'hook', label: 'Hook' })
    const revision = project.revision
    project = deriveCreativeStructureOnProject(project)
    expect(project.revision).toBe(revision + 1)
    expect(project.creativeStructure.source).toBe('intent_scenes')
    expect(project.creativeStructure.beats[0]?.kind).toBe('hook')
  })

  it('manual set_creative_structure marks source manual (#230)', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = setCreativeStructureOnProject(project, {
      beats: [{ kind: 'cta', from: 0, durationInFrames: 45 }],
      source: 'intent_scenes',
    })
    expect(project.creativeStructure.source).toBe('manual')
    expect(project.creativeStructure.beats[0]?.kind).toBe('cta')
  })

  it('backfill skips empty-scene and already-filled projects (#235)', () => {
    const empty = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    expect(shouldBackfillCreativeStructure(empty)).toBe(false)
    const withScenes = addSceneOnProject(empty, { role: 'hook', label: 'Hook' })
    expect(shouldBackfillCreativeStructure(withScenes)).toBe(true)
    expect(shouldBackfillCreativeStructure(deriveCreativeStructureOnProject(withScenes))).toBe(
      false,
    )
  })
})
