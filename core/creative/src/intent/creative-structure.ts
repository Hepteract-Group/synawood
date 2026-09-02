/** Creative structure DTOs + derive (ADR-0034 / #228–#229). Client-safe. */

import { z } from 'zod'

export const creativeBeatKindSchema = z.enum(['hook', 'education', 'trust', 'offer', 'cta'])
export type CreativeBeatKind = z.infer<typeof creativeBeatKindSchema>

export const creativeBeatSchema = z
  .object({
    kind: creativeBeatKindSchema,
    from: z.number().int().nonnegative(),
    durationInFrames: z.number().int().positive(),
    sceneId: z.string().min(1).max(64).optional(),
  })
  .strict()

export type CreativeBeat = z.infer<typeof creativeBeatSchema>

export const creativeStructureSchema = z
  .object({
    beats: z.array(creativeBeatSchema).max(24).default([]),
    source: z.enum(['intent_scenes', 'manual']).default('manual'),
    derivedAt: z.string().datetime().optional(),
  })
  .strict()

export type CreativeStructure = z.infer<typeof creativeStructureSchema>

export const emptyCreativeStructure = (): CreativeStructure =>
  creativeStructureSchema.parse({ beats: [], source: 'manual' })

const SCENE_ROLE_TO_BEAT: Record<string, CreativeBeatKind | null> = {
  hook: 'hook',
  problem: 'education',
  context: 'education',
  proof: 'trust',
  solution: 'offer',
  offer: 'offer',
  cta: 'cta',
  custom: null,
}

export const beatKindFromSceneRole = (role: string): CreativeBeatKind | null =>
  Object.prototype.hasOwnProperty.call(SCENE_ROLE_TO_BEAT, role) ? SCENE_ROLE_TO_BEAT[role]! : null

const DEFAULT_BEAT_FRAMES = 90

export type StructureSceneInput = {
  id: string
  role: string
  clipIds: string[]
  targetDurationFrames?: number
}

export type StructureClipInput = {
  id: string
  from: number
  durationInFrames: number
}

/** Map Scenes onto beats. `custom` and unknown roles are skipped. */
export const deriveCreativeStructure = (input: {
  scenes: StructureSceneInput[]
  clips: StructureClipInput[]
  now?: string
}): CreativeStructure => {
  const clipsById = new Map(input.clips.map((clip) => [clip.id, clip]))
  const beats: CreativeBeat[] = []
  let cursor = 0

  for (const scene of input.scenes) {
    const kind = beatKindFromSceneRole(scene.role)
    if (!kind) continue

    const assigned = scene.clipIds
      .map((id) => clipsById.get(id))
      .filter((clip): clip is StructureClipInput => Boolean(clip))

    let from = cursor
    let durationInFrames = scene.targetDurationFrames ?? DEFAULT_BEAT_FRAMES
    if (assigned.length > 0) {
      from = Math.min(...assigned.map((clip) => clip.from))
      const end = Math.max(...assigned.map((clip) => clip.from + clip.durationInFrames))
      durationInFrames = Math.max(1, end - from)
    }

    beats.push({ kind, from, durationInFrames, sceneId: scene.id })
    cursor = from + durationInFrames
    if (beats.length >= 24) break
  }

  return creativeStructureSchema.parse({
    beats,
    source: 'intent_scenes',
    derivedAt: input.now ?? new Date().toISOString(),
  })
}

export const parseCreativeStructure = (input: unknown): CreativeStructure =>
  creativeStructureSchema.parse(input)

export const structureBeatCount = (structure: CreativeStructure | null | undefined): number =>
  structure?.beats.length ?? 0
