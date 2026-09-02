'use client'

import { useCallback, useEffect, useState } from 'react'

export type VariantSibling = {
  id: string
  label: string
  status: string
}

type VariantChildRow = {
  id: string
  name?: string | null
  status: string
  variantSpec?: { label?: string } | null
}

/**
 * Ad versions that belong to the same main cut. Works from either side:
 * on a parent it lists its children, on a child it lists its siblings.
 */
export const useVariantSiblings = (input: {
  projectId: string
  parentProjectId: string | null
}): { siblings: VariantSibling[]; reload: () => void } => {
  const rootId = input.parentProjectId ?? input.projectId
  const [siblings, setSiblings] = useState<VariantSibling[]>([])

  const load = useCallback(async () => {
    const response = await fetch(`/api/studio/projects/${rootId}/variants`)
    if (!response.ok) return
    const body = (await response.json()) as { children?: VariantChildRow[] }
    setSiblings(
      (body.children ?? []).map((child) => ({
        id: child.id,
        label: child.variantSpec?.label ?? child.name ?? 'Ad version',
        status: child.status,
      })),
    )
  }, [rootId])

  useEffect(() => {
    void load()
  }, [load])

  return { siblings, reload: () => void load() }
}
