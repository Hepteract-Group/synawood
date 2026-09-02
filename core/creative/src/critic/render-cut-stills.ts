import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { createSignedBlobUrl, type BlobEnv } from '../persistence/blob'
import { toCampaignPackStillProps } from '../compositions/to-campaign-pack-props'
import { toSlideshowProps } from '../compositions/to-slideshow-props'
import { toTalkingHeadProps } from '../compositions/to-talking-head-props'
import {
  isAuthoredComposition,
  isCampaignPackComposition,
  isSlideshowComposition,
  type StudioProject,
} from '../project/schema'
import { bundleAuthoredForRender } from '../authored/bundle-for-render'
import { toAuthoredInputProps } from '../authored/input-props'
import type { CutReviewStill } from './inspect-preview'

const compositionsDir = path.dirname(fileURLToPath(import.meta.url))
const entryPoint = path.resolve(compositionsDir, '../compositions/entry.ts')

let bundlePromise: Promise<string> | undefined

const serveStudioComposition = async (): Promise<string> => {
  bundlePromise ??= bundle({
    entryPoint,
    webpackOverride: (config) => config,
  })
  return bundlePromise
}

const compositionInputProps = (
  project: StudioProject,
  blobEnv: BlobEnv,
): Record<string, unknown> => {
  const resolveUrl = (blobKey: string) =>
    createSignedBlobUrl({
      blobEnv,
      blobKey,
      expiresInSeconds: 60 * 30,
    })
  if (isSlideshowComposition(project.compositionId)) {
    const mapped = toSlideshowProps(project, resolveUrl)
    const { durationInFrames: _duration, ...props } = mapped
    return props
  }
  if (isCampaignPackComposition(project.compositionId)) {
    const mapped = toCampaignPackStillProps(project, resolveUrl)
    const { durationInFrames: _duration, ...props } = mapped
    return props
  }
  if (isAuthoredComposition(project.compositionId)) {
    return toAuthoredInputProps(project, resolveUrl)
  }
  return toTalkingHeadProps(project, resolveUrl)
}

/**
 * Encode cheap PNG stills from the real Remotion composition (ADR-0051).
 * Does not persist blobs — buffers go straight to the vision critic.
 * Call only from `automations/creative-cut-review.ts` (child process). Next.js
 * API routes cannot `bundle()` Remotion — see spawn-cut-stills.ts.
 */
export const renderCutReviewStills = async (input: {
  project: StudioProject
  blobEnv: BlobEnv
  frames: number[]
}): Promise<CutReviewStill[]> => {
  if (input.frames.length === 0) return []

  const workDir = await mkdtemp(path.join(tmpdir(), 'mos-cut-review-'))
  try {
    const inputProps = compositionInputProps(input.project, input.blobEnv)
    const authored = isAuthoredComposition(input.project.compositionId)
    const serveUrl = authored
      ? (
          await bundleAuthoredForRender({
            source: input.project.compositionSource?.source ?? '',
            workDir: path.join(workDir, 'authored-bundle'),
            inputProps: {
              ...toAuthoredInputProps(input.project, (blobKey) =>
                createSignedBlobUrl({
                  blobEnv: input.blobEnv,
                  blobKey,
                  expiresInSeconds: 60 * 30,
                }),
              ),
              durationInFrames: Math.max(1, input.project.durationFrames),
              fps: input.project.fps,
              width: input.project.width,
              height: input.project.height,
            },
          })
        ).serveUrl
      : await serveStudioComposition()
    const composition = await selectComposition({
      serveUrl,
      id: input.project.compositionId,
      inputProps,
    })
    const durationInFrames = Math.max(1, input.project.durationFrames)
    const renderComposition = { ...composition, durationInFrames }
    await mkdir(workDir, { recursive: true })

    const stills: CutReviewStill[] = []
    for (const rawFrame of input.frames) {
      const frame = Math.min(Math.max(0, rawFrame), durationInFrames - 1)
      const stillPath = path.join(workDir, `frame-${frame}.png`)
      await renderStill({
        composition: renderComposition,
        serveUrl,
        output: stillPath,
        inputProps,
        frame,
      })
      stills.push({ frame, bytes: await readFile(stillPath) })
    }
    return stills
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
