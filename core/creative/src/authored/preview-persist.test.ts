import { describe, expect, it } from 'vitest'
import { authoredPreviewShouldPersist } from './preview-persist'

describe('authoredPreviewShouldPersist (#1259)', () => {
  it('skips the project write when compile output is unchanged', () => {
    expect(
      authoredPreviewShouldPersist({
        existingCompileError: null,
        existingCompiledAtRevision: 4,
        nextCompileError: null,
        nextCompiledAtRevision: 4,
      }),
    ).toBe(false)
  })

  it('persists when compile error or compiled revision changes', () => {
    expect(
      authoredPreviewShouldPersist({
        existingCompileError: null,
        existingCompiledAtRevision: 3,
        nextCompileError: null,
        nextCompiledAtRevision: 4,
      }),
    ).toBe(true)
    expect(
      authoredPreviewShouldPersist({
        existingCompileError: null,
        existingCompiledAtRevision: 4,
        nextCompileError: 'Line 1: Blocked import',
        nextCompiledAtRevision: 4,
      }),
    ).toBe(true)
  })
})
