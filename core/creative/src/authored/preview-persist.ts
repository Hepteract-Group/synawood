export const authoredPreviewShouldPersist = (input: {
  existingCompileError: string | null | undefined
  existingCompiledAtRevision: number | undefined
  nextCompileError: string | null
  nextCompiledAtRevision: number | undefined
}): boolean =>
  (input.nextCompileError ?? null) !== (input.existingCompileError ?? null) ||
  (input.nextCompiledAtRevision ?? null) !== (input.existingCompiledAtRevision ?? null)
