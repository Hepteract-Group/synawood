import { describe, expect, it } from 'vitest'
import {
  DIRECTOR_VIBE_IDS,
  listSpecialistPackIds,
  mapStyleToDirectorVibe,
  specialistPack,
} from './specialist'

describe('mapStyleToDirectorVibe', () => {
  it('matches exact vibe ids', () => {
    for (const id of DIRECTOR_VIBE_IDS) {
      expect(mapStyleToDirectorVibe(id)).toMatchObject({ vibeId: id, matched: 'exact' })
    }
  })

  it('maps free text and falls back', () => {
    expect(mapStyleToDirectorVibe('quiet luxury polish')).toMatchObject({
      vibeId: 'premium',
      matched: 'mapped',
    })
    expect(mapStyleToDirectorVibe('make it ASMR neon soup')).toMatchObject({
      vibeId: 'informative',
      matched: 'fallback',
    })
  })
})

describe('specialistPack', () => {
  it('loads curated director vibes', async () => {
    const premium = await specialistPack('director-vibes', 'premium')
    expect(premium?.docId).toBe('premium')
    expect(premium?.body).toMatch(/Pacing/i)
    expect(premium?.matched).toBe('exact')
  })

  it('loads editor-cuts and copywriter-hooks packs', async () => {
    const editor = await specialistPack('editor-cuts')
    const copy = await specialistPack('copywriter-hooks', 'patterns')
    expect(editor?.body).toMatch(/pack_clips/)
    expect(copy?.body).toMatch(/Stop doing/)
  })

  it('lists packs including new Wave 2A specialists', async () => {
    const packs = await listSpecialistPackIds()
    expect(packs).toEqual(
      expect.arrayContaining(['director-vibes', 'editor-cuts', 'copywriter-hooks']),
    )
  })
})
