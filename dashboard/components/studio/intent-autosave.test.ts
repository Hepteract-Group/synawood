import { describe, expect, it, vi } from 'vitest'
import type { Intent } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import {
  createIntentAutosaveQueue,
  isIntentAutosaveNoOpError,
  performIntentAutosave,
} from './intent-autosave'

const intent = (partial: Partial<Intent> = {}): Intent => ({
  keywords: [],
  ...partial,
})

const project = (overrides: Partial<StudioProject> & { intent?: Intent; revision?: number }) =>
  ({
    id: '22222222-2222-4222-8222-222222222222',
    revision: overrides.revision ?? 2,
    intent: overrides.intent ?? intent({ emotion: 'urgent' }),
    ...overrides,
  }) as StudioProject

describe('isIntentAutosaveNoOpError', () => {
  it('matches soft no-op tool copy', () => {
    expect(isIntentAutosaveNoOpError('Tool had nothing new to apply')).toBe(true)
    expect(isIntentAutosaveNoOpError('already up to date')).toBe(true)
    expect(isIntentAutosaveNoOpError('network failed')).toBe(false)
  })
})

describe('performIntentAutosave', () => {
  it('skips when the patch is empty', async () => {
    const draft = intent({ emotion: 'urgent' })
    let baseline: Intent | null = intent({ emotion: 'urgent' })
    const fetchIntent = vi.fn()
    const outcome = await performIntentAutosave({
      projectId: 'p1',
      getRevision: () => 1,
      getDraft: () => draft,
      getBaseline: () => baseline,
      setBaseline: (next) => {
        baseline = next
      },
      setRevision: () => undefined,
      fetchIntent,
    })
    expect(outcome).toEqual({ kind: 'skipped_empty' })
    expect(fetchIntent).not.toHaveBeenCalled()
  })

  it('treats no-op tool errors as soft success and advances baseline', async () => {
    const draft = intent({ emotion: 'urgent', cta: 'Try the private example' })
    let baseline: Intent | null = intent({ emotion: 'urgent' })
    const outcome = await performIntentAutosave({
      projectId: 'p1',
      getRevision: () => 1,
      getDraft: () => draft,
      getBaseline: () => baseline,
      setBaseline: (next) => {
        baseline = next
      },
      setRevision: () => undefined,
      fetchIntent: async () => ({
        ok: false,
        status: 400,
        body: {
          error: 'Tool had nothing new to apply — the project already matches those inputs.',
        },
      }),
    })
    expect(outcome).toEqual({ kind: 'skipped_noop' })
    expect(baseline).toEqual(draft)
  })

  it('surfaces 409 conflicts with a refresh message', async () => {
    const draft = intent({ emotion: 'exciting' })
    let baseline: Intent | null = intent({ emotion: 'urgent' })
    const outcome = await performIntentAutosave({
      projectId: 'p1',
      getRevision: () => 1,
      getDraft: () => draft,
      getBaseline: () => baseline,
      setBaseline: (next) => {
        baseline = next
      },
      setRevision: () => undefined,
      fetchIntent: async () => ({
        ok: false,
        status: 409,
        body: { error: 'revision conflict' },
      }),
    })
    expect(outcome.kind).toBe('conflict')
    if (outcome.kind === 'conflict') {
      expect(outcome.message).toMatch(/updated elsewhere/i)
    }
  })

  it('saves and updates baseline + revision', async () => {
    const draft = intent({ emotion: 'exciting', platform: 'tiktok' })
    let baseline: Intent | null = intent({ emotion: 'urgent' })
    let revision = 1
    const saved = project({
      revision: 3,
      intent: intent({ emotion: 'exciting', platform: 'tiktok', keywords: [] }),
    })
    const outcome = await performIntentAutosave({
      projectId: 'p1',
      getRevision: () => revision,
      getDraft: () => draft,
      getBaseline: () => baseline,
      setBaseline: (next) => {
        baseline = next
      },
      setRevision: (next) => {
        revision = next
      },
      fetchIntent: async (input) => {
        expect(input.expectedRevision).toBe(1)
        expect(input.patch).toMatchObject({ emotion: 'exciting', platform: 'tiktok' })
        return { ok: true, status: 200, body: { project: saved } }
      },
    })
    expect(outcome).toEqual({ kind: 'saved', project: saved })
    expect(revision).toBe(3)
    expect(baseline?.emotion).toBe('exciting')
  })
})

describe('createIntentAutosaveQueue', () => {
  it('serializes overlapping saves so the second sees the first revision', async () => {
    const enqueue = createIntentAutosaveQueue()
    const order: number[] = []
    let revision = 1

    const first = enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push(revision)
      revision = 2
      return 'a'
    })
    const second = enqueue(async () => {
      order.push(revision)
      return 'b'
    })

    await expect(Promise.all([first, second])).resolves.toEqual(['a', 'b'])
    expect(order).toEqual([1, 2])
  })
})
