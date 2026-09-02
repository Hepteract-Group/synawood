/** Per-project paid-model consent in Studio chat footer. Default on (#1134). */

const storageKey = (projectId: string): string => `mos.studio.confirm-spend.${projectId}`

type Kv = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const browserStorage = (): Kv | null => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export const loadConfirmSpendPreference = (
  projectId: string,
  storage: Kv | null = browserStorage(),
): boolean => {
  if (!projectId || !storage) return true
  try {
    const raw = storage.getItem(storageKey(projectId))
    if (raw === null) return true
    if (raw === '0' || raw === 'false') return false
    return true
  } catch {
    return true
  }
}

export const persistConfirmSpendPreference = (
  projectId: string,
  allowed: boolean,
  storage: Kv | null = browserStorage(),
): void => {
  if (!projectId || !storage) return
  try {
    storage.setItem(storageKey(projectId), allowed ? '1' : '0')
  } catch {
    /* private mode */
  }
}
