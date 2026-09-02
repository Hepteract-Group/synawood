import { describe, expect, it } from 'vitest'
import { sceneLabel, sceneTokenFor, findSceneForToken } from './scene-token'

describe('scene-token', () => {
  const scene = { id: 'sc_b012eec69c4fxxxx', role: 'hook', label: 'Cold open' }

  it('labels with role and title', () => {
    expect(sceneLabel(scene)).toBe('Hook — Cold open')
  })

  it('round-trips token to scene', () => {
    const token = sceneTokenFor(scene)
    expect(token).toMatch(/^@scene:/)
    expect(findSceneForToken(token.slice('@scene:'.length), [scene])?.id).toBe(scene.id)
  })
})
