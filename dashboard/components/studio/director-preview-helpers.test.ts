import { describe, expect, it } from 'vitest'
import {
  directorCostLabel,
  directorEditLabel,
  directorScopeLabel,
  directorSkippedDetail,
  directorSkippedEdits,
  groupDirectorEditsByScene,
  selectedDirectorEditCount,
} from './director-preview-helpers'
import type { DirectorPlan } from '@synawood/creative/intent'

const basePlan = (edits: DirectorPlan['edits']): DirectorPlan => ({
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-08-04T12:00:00.000Z',
  projectRevision: 1,
  scope: 'global',
  edits,
  rationale: 'test',
  costEstimateGbp: 0.1,
  generatorCalls: [],
  status: 'draft',
  reasonerModelId: 'mock-reasoner',
})

describe('director-preview-helpers', () => {
  it('groups only actionable edits with short scene labels', () => {
    const groups = groupDirectorEditsByScene(
      [
        {
          id: 'a',
          mutation: { type: 'set_hook_title' },
          sceneId: 's1',
          previewText: 'Punchier hook text',
          status: 'proposed',
        },
        {
          id: 'b',
          mutation: { type: 'pack_clips' },
          status: 'proposed',
        },
        {
          id: 'c',
          mutation: { type: 'add_captions' },
          sceneId: 's1',
          status: 'rejected',
        },
      ],
      [{ id: 's1', role: 'hook', label: 'Hook - lead to CTA' }],
    )
    expect(groups).toEqual([
      {
        sceneId: 's1',
        label: 'Hook',
        edits: [expect.objectContaining({ id: 'a' })],
      },
      { sceneId: null, label: 'Timeline', edits: [expect.objectContaining({ id: 'b' })] },
    ])
    expect(directorSkippedEdits(groups.flatMap((g) => g.edits)).length).toBe(0)
  })

  it('labels edits from previewText, not tool names', () => {
    expect(
      directorEditLabel({
        id: 'a',
        mutation: { type: 'trim_clip' },
        previewText: 'Trim clip to 90 frames for faster pacing',
        status: 'proposed',
      }),
    ).toBe('Trim clip to 90 frames for faster pacing')
    expect(
      directorEditLabel({
        id: 'b',
        mutation: { type: 'pack_clips' },
        status: 'proposed',
      }),
    ).toBe('Close gaps between clips')
  })

  it('appends rejectReason on skipped detail lines', () => {
    expect(
      directorSkippedDetail({
        id: 'c',
        mutation: { type: 'trim_clip' },
        previewText: 'Shorten hook clip',
        status: 'rejected',
        rejectReason: 'missing clipId',
      }),
    ).toBe('Shorten hook clip — missing clipId')
  })

  it('counts selected non-rejected edits and free cost', () => {
    const plan = basePlan([
      { id: 'a', mutation: { type: 'pack_clips' }, status: 'proposed' },
      { id: 'b', mutation: { type: 'pack_clips' }, status: 'rejected' },
      { id: 'c', mutation: { type: 'pack_clips' }, status: 'proposed' },
    ])
    expect(selectedDirectorEditCount(plan, new Set(['c']))).toBe(1)
    expect(directorCostLabel({ ...plan, costEstimateGbp: 0 })).toBe('Free')
    expect(directorScopeLabel(plan)).toBe('Whole cut')
  })
})
