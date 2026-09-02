import type { Intent } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import { intentPatchFromDraft, isEmptyIntentPatch } from './intent-helpers'

export type IntentAutosaveFetchResult = {
  ok: boolean
  status: number
  body: { error?: string; project?: StudioProject }
}

export type IntentAutosaveDeps = {
  projectId: string
  getRevision: () => number
  getDraft: () => Intent
  getBaseline: () => Intent | null
  setBaseline: (intent: Intent) => void
  setRevision: (revision: number) => void
  fetchIntent: (input: {
    projectId: string
    expectedRevision: number
    patch: Partial<Intent>
  }) => Promise<IntentAutosaveFetchResult>
}

export type IntentAutosaveOutcome =
  | { kind: 'skipped_empty' }
  | { kind: 'skipped_noop' }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'saved'; project: StudioProject }

export const isIntentAutosaveNoOpError = (message: string): boolean =>
  /had nothing new to apply/i.test(message) ||
  /made no change to the project/i.test(message) ||
  /re-check inputs/i.test(message) ||
  /already on that scene/i.test(message) ||
  /already up to date/i.test(message)

/**
 * One Intent PATCH attempt — shared by the hook so races/409/no-op can be unit-tested
 * without a React renderer.
 */
export const performIntentAutosave = async (
  deps: IntentAutosaveDeps,
): Promise<IntentAutosaveOutcome> => {
  const baseline = deps.getBaseline()
  const draft = deps.getDraft()
  if (!baseline) {
    deps.setBaseline(draft)
    return { kind: 'skipped_empty' }
  }

  const patch = intentPatchFromDraft(baseline, draft)
  if (isEmptyIntentPatch(patch)) {
    return { kind: 'skipped_empty' }
  }

  // Recompute against latest baseline in case a prior save just finished.
  const latestBaseline = deps.getBaseline() ?? baseline
  const latestPatch = intentPatchFromDraft(latestBaseline, deps.getDraft())
  if (isEmptyIntentPatch(latestPatch)) {
    return { kind: 'skipped_empty' }
  }

  const response = await deps.fetchIntent({
    projectId: deps.projectId,
    expectedRevision: deps.getRevision(),
    patch: latestPatch,
  })

  if (!response.ok || !response.body.project) {
    const message = response.body.error ?? 'Failed to save intent'
    if (isIntentAutosaveNoOpError(message)) {
      deps.setBaseline(deps.getDraft())
      return { kind: 'skipped_noop' }
    }
    if (response.status === 409) {
      return {
        kind: 'conflict',
        message: 'Intent was updated elsewhere. Refresh the project to sync, then try again.',
      }
    }
    return { kind: 'error', message }
  }

  const project = response.body.project
  const savedIntent = {
    ...(project.intent ?? {}),
    keywords: project.intent?.keywords ?? [],
  }
  deps.setBaseline(savedIntent)
  deps.setRevision(project.revision)
  return { kind: 'saved', project }
}

/** Serialize async saves so overlapping flushes don't race on revision. */
export const createIntentAutosaveQueue = () => {
  let chain: Promise<unknown> = Promise.resolve()
  return <T>(run: () => Promise<T>): Promise<T> => {
    const queued = chain.then(run, run)
    chain = queued.then(
      () => undefined,
      () => undefined,
    )
    return queued
  }
}
