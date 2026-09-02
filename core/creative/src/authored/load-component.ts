import { authoredRequireName, type AuthoredRequireName } from './allowlist'

export type AuthoredRequireMap = Partial<Record<AuthoredRequireName, unknown>>

const unwrapModule = (mod: unknown): unknown => {
  if (!mod || typeof mod !== 'object') return mod
  const record = mod as Record<string, unknown>
  if (typeof record.jsx === 'function' || typeof record.useCurrentFrame === 'function') return mod
  if (record.default && typeof record.default === 'object') return record.default
  return mod
}

/** Eval transpiled CommonJS with an allowlisted require map (Player iframe + compile probe). */
export const loadAuthoredComponent = <T = unknown>(
  code: string,
  requireMap: AuthoredRequireMap,
): T => {
  const module = { exports: {} as { default?: T } & T }
  const require = (name: string) => {
    const key = authoredRequireName(name)
    const mapped = key ? unwrapModule(requireMap[key]) : undefined
    if (mapped) return mapped
    throw new Error(`Blocked import "${name}"`)
  }
  const run = new Function('module', 'exports', 'require', code)
  run(module, module.exports, require)
  const exported = module.exports as { default?: T } & T
  const Component = exported.default ?? (typeof exported === 'function' ? exported : undefined)
  if (!Component) {
    throw new Error('Composition source must default-export a component.')
  }
  return Component as T
}

export const namedMotionKitImports = (source: string): string[] => {
  const names: string[] = []
  const re = /import\s+\{([^}]+)\}\s+from\s+['"]@synawood\/creative\/motion-kit['"]/g
  for (const match of source.matchAll(re)) {
    for (const part of (match[1] ?? '').split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim()
      if (name) names.push(name)
    }
  }
  return names
}

/** Kit names imported in source that are not on the remotion-free export name list. */
export const missingMotionKitExports = (
  source: string,
  knownExportNames: readonly string[],
): string[] => {
  const known = new Set(knownExportNames)
  return namedMotionKitImports(source).filter((name) => !known.has(name))
}
