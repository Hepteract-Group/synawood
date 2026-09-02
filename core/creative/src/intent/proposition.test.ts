import { describe, expect, it } from 'vitest'
import { isFeatureDumpCopy, propositionIssues } from './proposition'

describe('proposition (#1223)', () => {
  it('flags Fast! Easy! AI-powered! copy', () => {
    expect(isFeatureDumpCopy('Fast! Easy! AI-powered!')).toBe(true)
    expect(isFeatureDumpCopy('Stop hunting 14 tender portals')).toBe(false)
  })

  it('flags empty primaryMessage after authored done, and more than two supports', () => {
    expect(propositionIssues({ keywords: [] }, { authoredClaimedDone: true })).toContain(
      'primaryMessage empty',
    )
    expect(
      propositionIssues(
        { keywords: [], supportingPoints: ['a', 'b', 'c'] },
        { authoredClaimedDone: false },
      ),
    ).toContain('supportingPoints exceeds 2')
    expect(
      propositionIssues(
        { keywords: [], primaryMessage: 'Stop hunting 14 portals', supportingPoints: ['a'] },
        { authoredClaimedDone: true },
      ),
    ).toEqual([])
  })
})
