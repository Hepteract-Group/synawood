/** Director basket picks (#174) — ordered asset/shot refs for Director/chat. */

export type DirectorBasketItem = {
  assetId: string
  shotId?: string
  caption?: string
  kind?: string | null
  addedAt: string
}

export const directorBasketStorageKey = (projectId: string): string =>
  `mos.studio.directorBasket.${projectId}`

export const parseDirectorBasket = (raw: string | null): DirectorBasketItem[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row): row is DirectorBasketItem => {
        if (!row || typeof row !== 'object') return false
        const assetId = (row as { assetId?: unknown }).assetId
        return typeof assetId === 'string' && assetId.length > 0
      })
      .map((row) => ({
        assetId: row.assetId,
        shotId: typeof row.shotId === 'string' ? row.shotId : undefined,
        caption: typeof row.caption === 'string' ? row.caption : undefined,
        kind: row.kind ?? null,
        addedAt: typeof row.addedAt === 'string' ? row.addedAt : new Date().toISOString(),
      }))
  } catch {
    return []
  }
}

export const addToDirectorBasket = (
  items: DirectorBasketItem[],
  next: Omit<DirectorBasketItem, 'addedAt'> & { addedAt?: string },
): DirectorBasketItem[] => {
  const withoutDup = items.filter(
    (item) => !(item.assetId === next.assetId && (item.shotId ?? '') === (next.shotId ?? '')),
  )
  return [
    ...withoutDup,
    {
      assetId: next.assetId,
      shotId: next.shotId,
      caption: next.caption,
      kind: next.kind ?? null,
      addedAt: next.addedAt ?? new Date().toISOString(),
    },
  ].slice(-24)
}

export const removeFromDirectorBasket = (
  items: DirectorBasketItem[],
  input: { assetId: string; shotId?: string },
): DirectorBasketItem[] =>
  items.filter(
    (item) => !(item.assetId === input.assetId && (item.shotId ?? '') === (input.shotId ?? '')),
  )

/** Chat / Director priming line from basket order. */
export const directorBasketPrompt = (items: DirectorBasketItem[]): string => {
  if (items.length === 0) return ''
  const lines = items.map((item, index) => {
    const shot = item.shotId ? ` shot ${item.shotId}` : ''
    const caption = item.caption ? ` (${item.caption.slice(0, 80)})` : ''
    return `${index + 1}. @asset:${item.assetId}${shot}${caption}`
  })
  return `Use these Director basket picks in order:\n${lines.join('\n')}`
}
