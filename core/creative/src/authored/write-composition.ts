import { compileAuthoredComposition, type AuthoredCompileResult } from './compile'
import { pickArtDirection, type ArtDirection } from '../motion-kit/catalog'
import { beatsToSequences } from '../intent/beats-to-sequences'
import { catalogNumbersFromProject } from './proof-numbers'
import { countUpValues } from './on-screen-text'
import {
  COMPOSITION_PRESETS,
  generateMotionSeed,
  parseStudioProject,
  type StudioProject,
} from '../project/schema'

export type AuthoredSourceFields = {
  source: string
  motionSeed: string
  artDirection: ArtDirection
}

export type WriteCompositionInput = {
  source: string
  motionSeed?: string
  artDirection?: ArtDirection
  recentFingerprints?: readonly string[]
  sequel?: boolean
}

export type WriteCompositionResult = {
  ok: true
  project: StudioProject
  compile: AuthoredCompileResult
}

export type WriteCompositionFailure = {
  ok: false
  error: string
}

const applyAuthoredSource = (
  project: StudioProject,
  input: AuthoredSourceFields,
): WriteCompositionResult => {
  const compile = compileAuthoredComposition(input.source)
  const invented = countUpValues(input.source).filter(
    (value) => !catalogNumbersFromProject(project).includes(value),
  )
  const claimError =
    invented.length > 0
      ? `CountUp value ${invented.join(', ')} is not in Catalog/DNA. Bind proofStat from Catalog or DNA, then write_composition.`
      : null
  const compileError = compile.ok ? claimError : compile.compileError
  const preset = COMPOSITION_PRESETS.authored
  const next = parseStudioProject({
    ...project,
    compositionId: 'authored',
    fps: preset.fps,
    width: preset.width,
    height: preset.height,
    compositionSource: {
      source: input.source,
      motionSeed: input.motionSeed,
      artDirection: input.artDirection,
      compileError,
      ...(compile.ok && !claimError ? { compiledAtRevision: Math.max(1, project.revision) } : {}),
    },
  })
  return {
    ok: true,
    project: next,
    compile: !compile.ok
      ? compile
      : claimError
        ? { ok: false, compileError: claimError, line: 1 }
        : compile,
  }
}

const resolveSeed = (project: StudioProject, requested?: string): string => {
  const trimmed = requested?.trim() ?? ''
  if (trimmed.length > 0) return trimmed
  const existing = project.compositionSource?.motionSeed?.trim() ?? ''
  return existing.length > 0 ? existing : generateMotionSeed()
}

const withBeatLayout = (
  project: StudioProject,
  artDirection: ArtDirection,
  motionSeed: string,
): ArtDirection => ({
  ...artDirection,
  beatLayout: beatsToSequences(
    project.creativeStructure,
    { dialect: artDirection.dialect, layout: artDirection.layout, seed: motionSeed },
    project.durationFrames,
  ),
})

const resolveArtDirection = (
  project: StudioProject,
  seed: string,
  requested?: ArtDirection,
  variety?: Pick<WriteCompositionInput, 'recentFingerprints' | 'sequel'>,
): ArtDirection => {
  if (requested) {
    return {
      ...requested,
      transitionFamily:
        requested.transitionFamily ??
        pickArtDirection({ seed, brandMood: project.brand?.mood }).transitionFamily,
    }
  }
  return pickArtDirection({
    seed,
    brandMood: project.brand?.mood,
    recentFingerprints: variety?.recentFingerprints,
    sequel: variety?.sequel,
  })
}

export const writeAuthoredComposition = (
  project: StudioProject,
  input: WriteCompositionInput,
): WriteCompositionResult => {
  const motionSeed = resolveSeed(project, input.motionSeed)
  const artDirection = withBeatLayout(
    project,
    resolveArtDirection(project, motionSeed, input.artDirection, {
      recentFingerprints: input.recentFingerprints,
      sequel: input.sequel,
    }),
    motionSeed,
  )
  return applyAuthoredSource(project, {
    source: input.source,
    motionSeed,
    artDirection,
  })
}

export const patchAuthoredComposition = (
  project: StudioProject,
  input: { find: string; replace: string },
): WriteCompositionResult | WriteCompositionFailure => {
  const current = project.compositionSource?.source
  if (current === undefined) {
    return { ok: false, error: 'No composition to patch. Call write_composition first.' }
  }
  if (input.find.length === 0) {
    return { ok: false, error: 'Patch find string is empty.' }
  }
  if (!current.includes(input.find)) {
    return { ok: false, error: 'That find string is not in the composition source.' }
  }
  const source = current.replace(input.find, input.replace)
  if (source === current) {
    return { ok: false, error: 'Patch did not change the composition source.' }
  }
  const motionSeed = resolveSeed(project)
  const artDirection = withBeatLayout(
    project,
    project.compositionSource?.artDirection ?? resolveArtDirection(project, motionSeed),
    motionSeed,
  )
  return applyAuthoredSource(project, { source, motionSeed, artDirection })
}

export const setAuthoredMotionSeed = (
  project: StudioProject,
  input?: {
    motionSeed?: string
    recentFingerprints?: readonly string[]
    sequel?: boolean
  },
): WriteCompositionResult | WriteCompositionFailure => {
  const current = project.compositionSource
  if (!current) {
    return { ok: false, error: 'No composition to reseed. Call write_composition first.' }
  }
  const motionSeed = input?.motionSeed?.trim() || generateMotionSeed()
  if (motionSeed === current.motionSeed) {
    return { ok: false, error: 'That motion seed is already set.' }
  }
  const artDirection = withBeatLayout(
    project,
    pickArtDirection({
      seed: motionSeed,
      brandMood: project.brand?.mood,
      recentFingerprints: input?.recentFingerprints,
      sequel: input?.sequel,
    }),
    motionSeed,
  )
  return applyAuthoredSource(project, {
    source: current.source,
    motionSeed,
    artDirection,
  })
}
