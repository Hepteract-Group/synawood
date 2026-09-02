/** #514 — place a Shot window onto the timeline (ADR-0047). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { addClip } from '../project/operations'
import type { StudioProject } from '../project/schema'

export type ShotWindow = {
  startMs: number
  endMs: number | null
}

export type ClipTiming = {
  trimStartFrames: number
  durationInFrames: number
}

export const msToFrames = (ms: number, fps: number): number =>
  Math.max(0, Math.round((ms / 1000) * fps))

export const shotWindowToClipTiming = (input: {
  startMs: number
  endMs: number | null
  fps: number
  fallbackDurationFrames?: number
}): ClipTiming => {
  const fps = input.fps > 0 ? input.fps : 30
  const trimStartFrames = msToFrames(input.startMs, fps)
  if (input.endMs == null) {
    return {
      trimStartFrames,
      durationInFrames: Math.max(1, input.fallbackDurationFrames ?? 90),
    }
  }
  const durationMs = Math.max(0, input.endMs - input.startMs)
  return {
    trimStartFrames,
    durationInFrames: Math.max(1, msToFrames(durationMs, fps)),
  }
}

export type PlaceShotInput = {
  assetId: string
  startMs: number
  endMs: number | null
  trackId?: string
  from?: number
}

export const placeShotOnProject = (
  project: StudioProject,
  input: PlaceShotInput,
): StudioProject => {
  const timing = shotWindowToClipTiming({
    startMs: input.startMs,
    endMs: input.endMs,
    fps: project.fps,
  })
  return addClip(project, {
    assetId: input.assetId,
    trackId: input.trackId,
    from: input.from,
    trimStartFrames: timing.trimStartFrames,
    durationInFrames: timing.durationInFrames,
  })
}

export type IndexedShot = {
  id: string
  assetId: string
  productId: string
  startMs: number
  endMs: number | null
}

export const loadIndexedShot = async (input: {
  supabase: SupabaseClient
  productId: string
  shotId: string
}): Promise<IndexedShot | null> => {
  const { data, error } = await input.supabase
    .from('asset_shots')
    .select('id, asset_id, product_id, start_ms, end_ms')
    .eq('product_id', input.productId)
    .eq('id', input.shotId)
    .maybeSingle()
  if (error) {
    throw new Error(`place_shot failed: ${error.message}`)
  }
  if (!data) return null
  return {
    id: data.id as string,
    assetId: data.asset_id as string,
    productId: data.product_id as string,
    startMs: data.start_ms as number,
    endMs: (data.end_ms as number | null) ?? null,
  }
}
