import { describe, expect, it } from 'vitest'
import {
  addToDirectorBasket,
  directorBasketPrompt,
  parseDirectorBasket,
  removeFromDirectorBasket,
} from './director-basket'

describe('director basket (#174)', () => {
  it('adds without duplicates and builds a prompt', () => {
    let items = addToDirectorBasket([], {
      assetId: '11111111-1111-4111-8111-111111111111',
      caption: 'Desk',
    })
    items = addToDirectorBasket(items, {
      assetId: '11111111-1111-4111-8111-111111111111',
      caption: 'Desk again',
    })
    expect(items).toHaveLength(1)
    items = addToDirectorBasket(items, {
      assetId: '22222222-2222-4222-8222-222222222222',
      shotId: 'shot_2',
    })
    expect(items).toHaveLength(2)
    expect(directorBasketPrompt(items)).toMatch(/Director basket picks/)
    expect(directorBasketPrompt(items)).toMatch(/@asset:22222222/)
  })

  it('round-trips localStorage JSON', () => {
    const raw = JSON.stringify([
      {
        assetId: '11111111-1111-4111-8111-111111111111',
        addedAt: '2026-08-16T00:00:00.000Z',
      },
    ])
    expect(parseDirectorBasket(raw)).toHaveLength(1)
    expect(
      removeFromDirectorBasket(parseDirectorBasket(raw), {
        assetId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual([])
  })
})
