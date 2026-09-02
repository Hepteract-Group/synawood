import { namedMotionKitImports } from './load-component'

const MOTION_KIT = '@synawood/creative/motion-kit'

/** JSX / calls the agent uses without importing the kit. */
export const MOTION_KIT_AUTO_IMPORTS = [
  'KineticType',
  'CountUp',
  'BrandText',
  'DeviceFrame',
  'OrbitLogo',
  'SceneWipe',
  'LottieStinger',
] as const

const usedKitNames = (source: string): string[] =>
  MOTION_KIT_AUTO_IMPORTS.filter((name) => new RegExp(`<${name}\\b|\\b${name}\\s*\\(`).test(source))

const importedKitNames = (source: string): Set<string> => new Set(namedMotionKitImports(source))

/** CountUp in JSX with no import compiles, then kills playback on that beat. Inject the kit. */
export const injectMissingMotionKitImports = (source: string): string => {
  const missing = usedKitNames(source).filter((name) => !importedKitNames(source).has(name))
  if (missing.length === 0) return source
  return `import { ${missing.join(', ')} } from '${MOTION_KIT}'\n${source}`
}
