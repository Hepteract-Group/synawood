import { describe, expect, it } from 'vitest'
import { historyMetaFromRow } from './history'

describe('historyMetaFromRow', () => {
  it('disables undo at revision 1 and redo at the tip', () => {
    expect(historyMetaFromRow({ revision: 1, history_tip: 1 })).toEqual({
      canUndo: false,
      canRedo: false,
      historyTip: 1,
    })
  })

  it('requires a prior snapshot before enabling undo', () => {
    expect(
      historyMetaFromRow({ revision: 3, history_tip: 5 }, { hasPriorSnapshot: false }),
    ).toEqual({
      canUndo: false,
      canRedo: true,
      historyTip: 5,
    })
    expect(historyMetaFromRow({ revision: 3, history_tip: 5 }, { hasPriorSnapshot: true })).toEqual(
      {
        canUndo: true,
        canRedo: true,
        historyTip: 5,
      },
    )
  })
})
