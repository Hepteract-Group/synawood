import { describe, expect, it } from 'vitest'
import {
  brandDnaLede,
  newProjectLandsIn,
  studioEmptyStateLine,
  workspaceOwnedBy,
} from './product-scope-copy'

describe('product scope copy', () => {
  it('names the Product on Studio empty state and create', () => {
    expect(studioEmptyStateLine('Okiki Alaso')).toBe(
      'Start a cut for Okiki Alaso. You’ll chat the edit, preview the timeline, then export when it’s ready.',
    )
    expect(newProjectLandsIn('Okiki Alaso')).toBe('This project will be created in Okiki Alaso.')
  })

  it('names the Product on Brand DNA', () => {
    expect(brandDnaLede('Okiki Alaso')).toBe(
      'Brand DNA is Okiki Alaso’s copy: who it is for, the offer, and what ads may claim. Catalog is a list of offers, not the Media bin.',
    )
  })

  it('asks them to pick a Product when none is active', () => {
    expect(studioEmptyStateLine(null)).toBe('Create or join a Product first, then start a cut.')
    expect(newProjectLandsIn(null)).toBe('Select a Product first.')
    expect(brandDnaLede(null)).toBe(
      'Brand DNA is this organization’s copy: who it is for, the offer, and what ads may claim. Catalog is a list of offers, not the Media bin.',
    )
  })

  it('names the organization on the open project', () => {
    expect(workspaceOwnedBy('Okiki Alaso')).toBe('In Okiki Alaso')
    expect(workspaceOwnedBy(null)).toBe('')
  })
})
