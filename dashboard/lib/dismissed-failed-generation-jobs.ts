/** Persist dismissed failed generation jobs so refresh does not resurrect them (#851). */

const storageKey = (projectId: string): string =>
  `mos.studio.dismissed-failed-generation-jobs.${projectId}`

type Kv = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const browserStorage = (): Kv | null => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export const loadDismissedFailedGenerationJobs = (
  projectId: string,
  storage: Kv | null = browserStorage(),
): Set<string> => {
  if (!projectId || !storage) return new Set()
  try {
    const raw = storage.getItem(storageKey(projectId))
    const parsed = JSON.parse(raw ?? '[]') as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

export const persistDismissedFailedGenerationJobs = (
  projectId: string,
  ids: ReadonlySet<string>,
  storage: Kv | null = browserStorage(),
): void => {
  if (!projectId || !storage) return
  try {
    storage.setItem(storageKey(projectId), JSON.stringify([...ids]))
  } catch {
    /* private mode */
  }
}

export const unseenFailedJobIds = (
  currentIds: readonly string[],
  alreadySeen: ReadonlySet<string>,
): string[] => currentIds.filter((id) => !alreadySeen.has(id))

/** Same snapshot would fail again — do not offer Retry. */
export const isRetryableGenerationFailure = (errorMessage: string | null | undefined): boolean => {
  if (!errorMessage?.trim()) return false
  const text = errorMessage.toLowerCase()
  if (/duration.*not valid|parameter.*not valid|not valid for model/.test(text)) return false
  if (/paid models are off|confirmspend/.test(text)) return false
  if (/unauthorized|forbidden/.test(text)) return false
  return /timeout|temporar|429|rate limit|network|econnreset|503|502/.test(text)
}
