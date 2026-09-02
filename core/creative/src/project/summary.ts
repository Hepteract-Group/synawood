import { lastContentEndFrames } from './operations'
import { normalizePipLayout, type PipLayout } from './pip-layout'
import type { StudioProject } from './schema'

export type ProjectSummaryClip = {
  id: string
  assetId: string
  from: number
  durationInFrames: number
  end: number
  kind: string
}

export type ProjectSummaryOverlay = {
  id: string
  kind: string
  text: string
  from: number
  durationInFrames: number
  end: number
}

export type ProjectSummary = {
  id: string
  productId: string
  compositionId: string
  status: string
  revision: number
  clipCount: number
  assetCount: number
  fps: number
  durationSeconds: number
  /** End of last clip/overlay in seconds — use for append / end-screen placement. */
  contentEndSeconds: number
  clips: ProjectSummaryClip[]
  overlays?: ProjectSummaryOverlay[]
  headline: string
  activeLocale?: string
  pipLayout?: PipLayout
  /** Last authored compile error. Null/omitted when green or not authored. */
  compileError?: string | null
}

export const summarizeProject = (project: StudioProject): ProjectSummary => {
  const durationSeconds = Math.round((project.durationFrames / project.fps) * 10) / 10
  const contentEndSeconds = Math.round((lastContentEndFrames(project) / project.fps) * 10) / 10
  const hook = project.overlays.find((overlay) => overlay.kind === 'hook_title')?.text
  const headline =
    project.name?.trim() ||
    hook?.trim() ||
    `${project.compositionId.replaceAll('_', ' ')} · ${project.clips.length} clips`
  const clips = project.clips
    .slice()
    .sort((a, b) => a.from - b.from)
    .map((clip) => {
      const asset = project.assets.find((item) => item.id === clip.assetId)
      return {
        id: clip.id,
        assetId: clip.assetId,
        from: clip.from,
        durationInFrames: clip.durationInFrames,
        end: clip.from + clip.durationInFrames,
        kind: asset?.kind ?? 'unknown',
      }
    })
  return {
    id: project.id,
    productId: project.productId,
    compositionId: project.compositionId,
    status: project.status,
    revision: project.revision,
    clipCount: project.clips.length,
    assetCount: project.assets.length,
    fps: project.fps,
    durationSeconds,
    contentEndSeconds,
    clips,
    overlays: project.overlays.map((overlay) => ({
      id: overlay.id,
      kind: overlay.kind,
      text: overlay.text,
      from: overlay.from,
      durationInFrames: overlay.durationInFrames,
      end: overlay.from + overlay.durationInFrames,
    })),
    headline,
    activeLocale: project.localization?.activeLocale ?? 'en',
    pipLayout: normalizePipLayout(project.pipLayout),
    ...(project.compositionSource?.compileError
      ? { compileError: project.compositionSource.compileError }
      : {}),
  }
}
