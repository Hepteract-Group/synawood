export type ProjectLineageItem = {
  id: string
  parentProjectId?: string | null
  variantLabel?: string | null
}

export type ProjectTreeNode<T extends ProjectLineageItem> = {
  project: T
  versions: T[]
}

/**
 * Group ad versions under their main cut so Studio home shows one card per parent.
 * Orphan children (parent deleted or outside this product) stay top-level.
 */
export const buildProjectTree = <T extends ProjectLineageItem>(
  projects: T[],
): ProjectTreeNode<T>[] => {
  const byId = new Map(projects.map((project) => [project.id, project]))
  const versionsByParent = new Map<string, T[]>()

  for (const project of projects) {
    const parentId = project.parentProjectId
    if (!parentId || !byId.has(parentId)) continue
    const existing = versionsByParent.get(parentId)
    if (existing) existing.push(project)
    else versionsByParent.set(parentId, [project])
  }

  return projects
    .filter((project) => {
      const parentId = project.parentProjectId
      return !parentId || !byId.has(parentId)
    })
    .map((project) => ({
      project,
      versions: versionsByParent.get(project.id) ?? [],
    }))
}
