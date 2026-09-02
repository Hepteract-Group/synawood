import { describe, expect, it } from 'vitest'
import {
  campaignImageProfileNote,
  resolveCampaignImageProfileId,
  resolveCampaignVideoProfileId,
} from './image-profile'

describe('resolveCampaignImageProfileId (#461)', () => {
  it('keeps profiles that can generate images', () => {
    expect(resolveCampaignImageProfileId('ci-stub')).toBe('ci-stub')
    expect(resolveCampaignImageProfileId('cheap-draft')).toBe('cheap-draft')
  })

  it('falls back when founder-edit disables image', () => {
    expect(resolveCampaignImageProfileId('founder-edit')).toBe('ci-stub')
    expect(campaignImageProfileNote('founder-edit', 'ci-stub')).toMatch(/founder-edit/)
  })
})

describe('resolveCampaignVideoProfileId (#467)', () => {
  it('falls back when founder-edit disables video', () => {
    expect(resolveCampaignVideoProfileId('founder-edit')).toBe('ci-stub')
  })

  it('keeps video-capable profiles', () => {
    expect(resolveCampaignVideoProfileId('ci-stub')).toBe('ci-stub')
    expect(resolveCampaignVideoProfileId('cheap-draft')).toBe('cheap-draft')
  })
})
