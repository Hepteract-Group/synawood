import type {
  CreativeBeatKind,
  CreativeStructure,
} from '@synawood/creative/intent/creative-structure'

const BEAT_LABEL: Record<CreativeBeatKind, string> = {
  hook: 'Hook',
  education: 'Teach',
  trust: 'Proof',
  offer: 'Offer',
  cta: 'Ask',
}

export const STRUCTURE_FILL_BUTTON = 'Fill from scenes'
export const STRUCTURE_FILL_DISABLED_HINT = 'Add scenes first'
export const STRUCTURE_FILLING = 'Filling story from scenes…'
export const STRUCTURE_FILL_ERROR = 'Could not fill the story from scenes.'
export const STRUCTURE_EMPTY_META = 'Not set'
export const STRUCTURE_SIGNOFF_LABEL = 'No story snapshot'
export const STRUCTURE_SIGNOFF_BODY =
  'Approve still works. Fill from scenes if you want the hook and ask saved on the Final.'
export const STRUCTURE_MANUAL_HINT = 'edited'
export const STRUCTURE_SOURCE_SCENES = 'scenes'
export const STRUCTURE_SNAPSHOT_EMPTY = 'No story on this Final.'
export const STRUCTURE_SNAPSHOT_LEDE =
  'Structure copied at Approve. This page is read-only. Change the story in Studio before the next export.'
export const STRUCTURE_SNAPSHOT_EMPTY_HINT =
  'The cut was Approved without a story snapshot. Fill from scenes in Studio on the next revision.'

export const structureBeatLabel = (kind: CreativeBeatKind): string => BEAT_LABEL[kind]

export const structureSourceLabel = (source: CreativeStructure['source']): string =>
  source === 'manual' ? STRUCTURE_MANUAL_HINT : STRUCTURE_SOURCE_SCENES

export const structureEmptyBody = (sceneCount: number): string =>
  sceneCount === 0
    ? 'This is the ad’s story: stop the scroll, teach, prove it, make the offer, then ask.\n\nOptional. Add scenes on the strip above the timeline first. You can still Approve without this.'
    : 'No story mapped yet. Fill from your scenes. This does not change the timeline.'

export const structureFilledMeta = (kinds: readonly CreativeBeatKind[]): string => {
  const seen = new Set<CreativeBeatKind>()
  const labels: string[] = []
  for (const kind of kinds) {
    if (seen.has(kind)) continue
    seen.add(kind)
    labels.push(BEAT_LABEL[kind])
  }
  return labels.join(' · ')
}
