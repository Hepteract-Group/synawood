/** First-party Remotion style packs (ADR-0045). Client-safe JSON imports; no fs. */

import { z } from 'zod'
import cinematicTealOrange from './packs/cinematic-teal-orange.json'
import luxuryPerfume from './packs/luxury-perfume.json'
import vhs from './packs/vhs.json'
import coolSteel from './packs/cool-steel.json'
import warmSun from './packs/warm-sun.json'
import night from './packs/night.json'
import pulp from './packs/pulp.json'
import paper from './packs/paper.json'
import bleach from './packs/bleach.json'
import fog from './packs/fog.json'
import candy from './packs/candy.json'

export const STYLE_PACK_IDS = [
  'cinematic-teal-orange',
  'luxury-perfume',
  'vhs',
  'cool-steel',
  'warm-sun',
  'night',
  'pulp',
  'paper',
  'bleach',
  'fog',
  'candy',
] as const
export type StylePackId = (typeof STYLE_PACK_IDS)[number]

export const stylePackIdSchema = z.enum(STYLE_PACK_IDS)

export const stylePackLicenseSchema = z.enum(['first-party'])

export const stylePackSchema = z
  .object({
    id: stylePackIdSchema,
    label: z.string().min(1).max(80),
    license: stylePackLicenseSchema,
    contrast: z.number().min(0.5).max(2),
    saturate: z.number().min(0).max(3),
    hueRotate: z.number().min(-180).max(180),
    sepia: z.number().min(0).max(1),
    vignette: z.number().min(0).max(1),
    promptHints: z.array(z.string().min(1).max(120)).max(8),
    musicHints: z.array(z.string().min(1).max(120)).max(8),
  })
  .strict()

export type StylePack = z.infer<typeof stylePackSchema>

export const STYLE_PACKS: Record<StylePackId, StylePack> = {
  'cinematic-teal-orange': stylePackSchema.parse(cinematicTealOrange),
  'luxury-perfume': stylePackSchema.parse(luxuryPerfume),
  vhs: stylePackSchema.parse(vhs),
  'cool-steel': stylePackSchema.parse(coolSteel),
  'warm-sun': stylePackSchema.parse(warmSun),
  night: stylePackSchema.parse(night),
  pulp: stylePackSchema.parse(pulp),
  paper: stylePackSchema.parse(paper),
  bleach: stylePackSchema.parse(bleach),
  fog: stylePackSchema.parse(fog),
  candy: stylePackSchema.parse(candy),
}

export const listStylePacks = (): StylePack[] => STYLE_PACK_IDS.map((id) => STYLE_PACKS[id])

export const getStylePack = (id: string | null | undefined): StylePack | null => {
  if (!id) return null
  if ((STYLE_PACK_IDS as readonly string[]).includes(id)) {
    return STYLE_PACKS[id as StylePackId]
  }
  return null
}

export const isStylePackId = (id: string): id is StylePackId =>
  (STYLE_PACK_IDS as readonly string[]).includes(id)

/** CSS filter string for catalog before/after tiles. */
export const cssFilterForPack = (
  pack: Pick<StylePack, 'contrast' | 'saturate' | 'hueRotate' | 'sepia'>,
): string =>
  `contrast(${pack.contrast}) saturate(${pack.saturate}) hue-rotate(${pack.hueRotate}deg) sepia(${pack.sepia})`
