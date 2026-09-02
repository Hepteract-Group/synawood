/** Imports the Player iframe can require. Prefix-matching `@remotion/` lets fake packages compile. */
export const AUTHORED_IMPORT_ALLOWLIST = [
  'remotion',
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@synawood/creative/motion-kit',
  '@remotion/lottie',
  '@remotion/transitions',
  '@remotion/shapes',
  '@remotion/three',
] as const

export type AuthoredImport = (typeof AUTHORED_IMPORT_ALLOWLIST)[number]

/** Allowlisted specifier, including `@remotion/transitions/fade` subpaths. */
export type AuthoredRequireName = AuthoredImport | `@remotion/${string}`

const KIT_ALIASES = new Set([
  '@motion-kit',
  '@remotion/motion-kit',
  'motion-kit',
  '@synawood/motion-kit',
])

const MOTION_KIT = '@synawood/creative/motion-kit'

const REMOTION_PACKAGES = [
  '@remotion/lottie',
  '@remotion/transitions',
  '@remotion/shapes',
  '@remotion/three',
] as const

const remotionPackageOf = (specifier: string): (typeof REMOTION_PACKAGES)[number] | null =>
  REMOTION_PACKAGES.find((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`)) ?? null

export const isAllowlistedAuthoredImport = (specifier: string): boolean => {
  const trimmed = specifier.trim()
  if (trimmed.startsWith('node:')) return false
  for (const allowed of AUTHORED_IMPORT_ALLOWLIST) {
    if (trimmed === allowed) return true
  }
  if (trimmed.startsWith(`${MOTION_KIT}/`)) return true
  if (trimmed.startsWith('remotion/')) return true
  return remotionPackageOf(trimmed) != null
}

/** Player `require` key for an allowlisted specifier (kit subpaths share the kit module). */
export const authoredRequireName = (specifier: string): AuthoredRequireName | null => {
  const trimmed = specifier.trim()
  if (!isAllowlistedAuthoredImport(trimmed)) return null
  if (trimmed === MOTION_KIT || trimmed.startsWith(`${MOTION_KIT}/`)) return MOTION_KIT
  if (trimmed === 'remotion' || trimmed.startsWith('remotion/')) return 'remotion'
  const remotionPkg = remotionPackageOf(trimmed)
  if (remotionPkg) return trimmed as AuthoredRequireName
  if ((AUTHORED_IMPORT_ALLOWLIST as readonly string[]).includes(trimmed)) {
    return trimmed as AuthoredImport
  }
  return null
}

export const blockedAuthoredImportMessage = (
  specifier: string,
  kind: 'import' | 'require' = 'import',
): string => {
  const trimmed = specifier.trim()
  const verb = kind === 'require' ? 'require' : 'import'
  if (KIT_ALIASES.has(trimmed) || /motion-kit/i.test(trimmed)) {
    return `Blocked ${verb} "${trimmed}". Import KineticType, CountUp, BrandText, DeviceFrame from "${MOTION_KIT}".`
  }
  return `Blocked ${verb} "${trimmed}". Use remotion, @remotion/lottie, @remotion/transitions, react, or ${MOTION_KIT}.`
}
