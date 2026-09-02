/** Optimistic concurrency failure when persist expectedRevision does not match. */
export class RevisionConflictError extends Error {
  readonly expected: number
  readonly actual: number

  constructor(expected: number, actual: number) {
    super(`Project revision conflict: expected ${expected}, found ${actual}. Reload and try again.`)
    this.name = 'RevisionConflictError'
    this.expected = expected
    this.actual = actual
  }
}
