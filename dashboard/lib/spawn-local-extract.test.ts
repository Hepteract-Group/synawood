import { describe, expect, it } from 'vitest'
import { localExtractWorkerSpawn } from './spawn-local-extract'

describe('localExtractWorkerSpawn', () => {
  it('runs tsx automations/creative-extract.ts, not npm run', () => {
    const spec = localExtractWorkerSpawn('job-1', '/tmp/not-the-repo')
    expect(spec.cmd).toBe(process.execPath)
    expect(spec.args).toEqual([
      '--env-file-if-exists=.env',
      '--import',
      'tsx',
      'automations/creative-extract.ts',
      '--job',
      'job-1',
    ])
    expect(spec.args.join(' ')).not.toMatch(/\bnpm\b/)
  })
})
