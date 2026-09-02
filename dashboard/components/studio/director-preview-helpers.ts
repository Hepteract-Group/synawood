import type { DirectorPlan, DirectorPlanEdit, Scene } from '@synawood/creative/intent'

export type DirectorEditGroup = {
  sceneId: string | null
  label: string
  edits: DirectorPlanEdit[]
}

const MUTATION_LABELS: Record<string, string> = {
  pack_clips: 'Close gaps between clips',
  trim_clip: 'Shorten a clip',
  place_overlay: 'Add on-screen text',
  remove_overlay: 'Remove an overlay',
  set_hook_title: 'Set hook title',
  set_end_card: 'Set end card',
  set_cover_frame: 'Set cover frame',
  add_captions: 'Add captions',
  place_clip: 'Move a clip',
  split_clip: 'Split a clip',
  remove_clip: 'Remove a clip',
}

/** Plain-English row label — prefer agent previewText; never lead with snake_case tools. */
export const directorEditLabel = (edit: DirectorPlanEdit): string => {
  const preview = edit.previewText?.trim()
  if (preview) return preview
  const known = MUTATION_LABELS[edit.mutation.type]
  if (known) return known
  return edit.mutation.type.replaceAll('_', ' ')
}

export const directorSkippedDetail = (edit: DirectorPlanEdit): string => {
  const label = directorEditLabel(edit)
  const reason = edit.rejectReason?.trim()
  return reason ? `${label} — ${reason}` : label
}

const sceneGroupLabel = (
  sceneId: string,
  scenes: Pick<Scene, 'id' | 'role' | 'label'>[],
): string => {
  const scene = scenes.find((entry) => entry.id === sceneId)
  if (!scene) return 'Timeline'
  const role = scene.role.charAt(0).toUpperCase() + scene.role.slice(1)
  // Prefer short role when label restates it.
  if (!scene.label || scene.label.toLowerCase().startsWith(scene.role.toLowerCase())) {
    return role
  }
  return `${role} · ${scene.label}`
}

/**
 * Group actionable (proposed) edits by scene.
 * Rejected / invalid ideas stay out of the checklist.
 */
export const groupDirectorEditsByScene = (
  edits: DirectorPlanEdit[],
  scenes: Pick<Scene, 'id' | 'role' | 'label'>[] = [],
): DirectorEditGroup[] => {
  const actionable = edits.filter((edit) => edit.status !== 'rejected')
  const order: string[] = []
  const buckets = new Map<string, DirectorPlanEdit[]>()
  const otherKey = '__other__'

  for (const edit of actionable) {
    const key = edit.sceneId ?? otherKey
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)!.push(edit)
  }

  return order.map((key) => {
    if (key === otherKey) {
      return { sceneId: null, label: 'Timeline', edits: buckets.get(key)! }
    }
    return { sceneId: key, label: sceneGroupLabel(key, scenes), edits: buckets.get(key)! }
  })
}

export const directorSkippedEdits = (edits: DirectorPlanEdit[]): DirectorPlanEdit[] =>
  edits.filter((edit) => edit.status === 'rejected')

export const directorScopeLabel = (plan: DirectorPlan): string => {
  if (plan.scope === 'global') return 'Whole cut'
  if ('sceneIds' in plan.scope) return `${plan.scope.sceneIds.length} scenes`
  return `${plan.scope.clipIds.length} clips`
}

export const selectedDirectorEditCount = (
  plan: DirectorPlan,
  excluded: ReadonlySet<string>,
): number =>
  plan.edits.filter((edit) => edit.status !== 'rejected' && !excluded.has(edit.id)).length

export const directorCostLabel = (plan: DirectorPlan): string => {
  if (plan.costEstimateGbp <= 0 && plan.generatorCalls.length === 0) return 'Free'
  return `£${plan.costEstimateGbp.toFixed(2)}`
}
