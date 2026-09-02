import type { EvalFixture } from './fixtures'

export type FixtureScore = {
  id: string
  title: string
  ok: boolean
  error?: string
  durationMs: number
}

export type EvalScorecard = {
  runAt: string
  reasoner: string
  results: FixtureScore[]
  passed: number
  failed: number
}

export const scoreFixture = (
  fixture: EvalFixture,
  run: () => Promise<void>,
): Promise<FixtureScore> => {
  const started = Date.now()
  return run()
    .then(() => ({
      id: fixture.id,
      title: fixture.title,
      ok: true,
      durationMs: Date.now() - started,
    }))
    .catch((error: unknown) => ({
      id: fixture.id,
      title: fixture.title,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    }))
}

export const buildScorecard = (reasoner: string, results: FixtureScore[]): EvalScorecard => ({
  runAt: new Date().toISOString(),
  reasoner,
  results,
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
})

export const formatScorecard = (card: EvalScorecard): string => {
  const lines = [
    `Studio Agent eval — reasoner=${card.reasoner}  ${card.passed}/${card.results.length} passed`,
    ...card.results.map((r) => {
      const mark = r.ok ? 'PASS' : 'FAIL'
      const err = r.error ? ` — ${r.error}` : ''
      return `  [${mark}] ${r.id} (${r.durationMs}ms)${err}`
    }),
  ]
  return lines.join('\n')
}
