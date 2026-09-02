/** Shared pack executable names (ADR-0039 / #287). Client-safe — no Node builtins. */

export const isPackExecutablePath = (entryPath: string): boolean => {
  const normalized = entryPath.replace(/\\/g, '/')
  const base = (normalized.split('/').pop() ?? '').toLowerCase()
  return (
    base.endsWith('.exe') ||
    base.endsWith('.sh') ||
    base.endsWith('.bat') ||
    base.endsWith('.cmd') ||
    base.endsWith('.dylib') ||
    base.endsWith('.so') ||
    base === 'node_modules'
  )
}
