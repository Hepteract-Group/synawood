import { describe, expect, it } from 'vitest'
import {
  STRUCTURE_EMPTY_META,
  STRUCTURE_FILL_BUTTON,
  STRUCTURE_FILL_DISABLED_HINT,
  STRUCTURE_FILL_ERROR,
  STRUCTURE_FILLING,
  STRUCTURE_MANUAL_HINT,
  STRUCTURE_SIGNOFF_BODY,
  STRUCTURE_SIGNOFF_LABEL,
  STRUCTURE_SNAPSHOT_EMPTY,
  STRUCTURE_SNAPSHOT_EMPTY_HINT,
  STRUCTURE_SNAPSHOT_LEDE,
  STRUCTURE_SOURCE_SCENES,
  structureBeatLabel,
  structureEmptyBody,
  structureFilledMeta,
  structureSourceLabel,
} from './studio-structure-copy'

const operatorFacing = [
  STRUCTURE_EMPTY_META,
  STRUCTURE_FILL_BUTTON,
  STRUCTURE_FILL_DISABLED_HINT,
  STRUCTURE_FILL_ERROR,
  STRUCTURE_FILLING,
  STRUCTURE_SIGNOFF_BODY,
  STRUCTURE_SIGNOFF_LABEL,
  STRUCTURE_MANUAL_HINT,
  STRUCTURE_SOURCE_SCENES,
  STRUCTURE_SNAPSHOT_EMPTY,
  STRUCTURE_SNAPSHOT_EMPTY_HINT,
  STRUCTURE_SNAPSHOT_LEDE,
  structureEmptyBody(0),
  structureEmptyBody(3),
  structureFilledMeta(['hook', 'education', 'trust', 'offer', 'cta']),
  structureBeatLabel('hook'),
  structureBeatLabel('education'),
  structureBeatLabel('trust'),
  structureBeatLabel('offer'),
  structureBeatLabel('cta'),
  structureSourceLabel('manual'),
  structureSourceLabel('intent_scenes'),
]

describe('studio structure operator copy', () => {
  it('never says beat or derive to the operator', () => {
    for (const line of operatorFacing) {
      expect(line.toLowerCase()).not.toMatch(/\bbeats?\b/)
      expect(line.toLowerCase()).not.toMatch(/deriv/)
    }
  })

  it('explains the story and next step when there are no scenes', () => {
    const body = structureEmptyBody(0)
    expect(body).toContain('stop the scroll')
    expect(body).toContain('strip above the timeline')
    expect(body).toContain('Approve')
  })

  it('tells them to fill from scenes when scenes exist', () => {
    expect(structureEmptyBody(2)).toBe(
      'No story mapped yet. Fill from your scenes. This does not change the timeline.',
    )
    expect(STRUCTURE_FILL_BUTTON).toBe('Fill from scenes')
  })

  it('summarises filled kinds in first-seen order', () => {
    expect(structureFilledMeta(['hook', 'cta', 'hook'])).toBe('Hook · Ask')
    expect(structureFilledMeta(['education', 'trust', 'offer'])).toBe('Teach · Proof · Offer')
  })

  it('labels snapshot source without saying manual', () => {
    expect(structureSourceLabel('manual')).toBe(STRUCTURE_MANUAL_HINT)
    expect(structureSourceLabel('intent_scenes')).toBe(STRUCTURE_SOURCE_SCENES)
  })
})
