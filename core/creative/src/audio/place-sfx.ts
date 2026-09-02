import { randomUUID } from 'node:crypto'
import { addClip, attachAsset } from '../project/operations'
import type { ProjectAsset, StudioProject } from '../project/schema'
import { ensureDefaultTracks, SFX_TRACK_ID } from '../project/tracks'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'
import { getSfxPackItem, type SfxPackId } from './sfx-catalog'

const sfxRole = (asset: ProjectAsset): string | undefined => {
  const role = asset.probe?.role
  return typeof role === 'string' ? role : undefined
}

const sfxPackIdOf = (asset: ProjectAsset): string | undefined => {
  const packId = asset.probe?.packId
  return typeof packId === 'string' ? packId : undefined
}

export const firstPartySfxAsset = (input: {
  packId: SfxPackId
  blobKey: string
  assetId?: string
  durationFrames: number
}): ProjectAsset => {
  const item = getSfxPackItem(input.packId)
  if (!item) {
    throw new Error(`Unknown sound: ${input.packId}`)
  }
  return {
    id: input.assetId ?? randomUUID(),
    kind: 'audio',
    blobKey: input.blobKey,
    contentType: 'audio/wav',
    source: 'generator',
    probe: {
      role: 'sfx',
      packId: item.id,
      license: 'first-party',
      name: item.label,
      durationFrames: input.durationFrames,
    },
  }
}

export const findSfxAsset = (project: StudioProject, packId: SfxPackId): ProjectAsset | undefined =>
  project.assets.find((asset) => sfxRole(asset) === 'sfx' && sfxPackIdOf(asset) === packId)

export const isSfxAsset = (asset: ProjectAsset | undefined): boolean =>
  Boolean(asset && asset.kind === 'audio' && sfxRole(asset) === 'sfx')

export const placeSfx = (
  project: StudioProject,
  input: {
    packId: SfxPackId
    from?: number
    blobKey?: string
    asset?: ProjectAsset
  },
): StudioProject => {
  const item = getSfxPackItem(input.packId)
  if (!item) {
    throw new Error(`Unknown sound: ${input.packId}`)
  }
  const withTracks = ensureDefaultTracks(project)
  const fps = withTracks.fps > 0 ? withTracks.fps : 30
  const durationInFrames = Math.max(1, Math.round(item.durationSeconds * fps))
  const existing = findSfxAsset(withTracks, item.id)
  const asset =
    input.asset ??
    existing ??
    firstPartySfxAsset({
      packId: item.id,
      blobKey: input.blobKey ?? `local/marketing-os/${withTracks.productId}/sfx/${item.id}.wav`,
      durationFrames: durationInFrames,
    })
  if (asset.kind !== 'audio') {
    throw new Error('That sound is not audio')
  }
  let next = withTracks
  if (!next.assets.some((entry) => entry.id === asset.id)) {
    next = attachAsset(next, asset)
  }
  next = addClip(next, {
    assetId: asset.id,
    trackId: SFX_TRACK_ID,
    from: input.from ?? 0,
    durationInFrames,
  })
  const placed = next.clips.filter((clip) => clip.assetId === asset.id).at(-1)
  return appendWhyLog(next, {
    t: secondsAtFrame(next, placed?.from ?? input.from ?? 0),
    target: placed?.id ?? SFX_TRACK_ID,
    action: 'sfx',
    reason: item.id === 'whoosh' ? 'Added a whoosh.' : 'Added a hit on the call to action.',
  })
}
