export type StudioChromeDismissKind = 'extract'

const storageKey = (kind: StudioChromeDismissKind, projectId: string): string =>
  `mos.studio.dismissed.${kind}.${projectId}`

type Kv = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const browserStorage = (): Kv | null => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export const isStudioChromeDismissed = (
  kind: StudioChromeDismissKind,
  projectId: string,
  id: string | null | undefined,
  storage: Kv | null = browserStorage(),
): boolean => {
  if (!id || !storage) return false
  try {
    return storage.getItem(storageKey(kind, projectId)) === id
  } catch {
    return false
  }
}

export const markStudioChromeDismissed = (
  kind: StudioChromeDismissKind,
  projectId: string,
  id: string,
  storage: Kv | null = browserStorage(),
): void => {
  if (!storage) return
  try {
    storage.setItem(storageKey(kind, projectId), id)
  } catch {
    /* private mode */
  }
}

export const clearStudioChromeDismissed = (
  kind: StudioChromeDismissKind,
  projectId: string,
  storage: Kv | null = browserStorage(),
): void => {
  if (!storage) return
  try {
    storage.removeItem(storageKey(kind, projectId))
  } catch {
    /* private mode */
  }
}
