import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { parseCutReviewWorkerResult, spawnCutReviewStills } from './spawn-cut-stills'
import type { StudioProject } from '../project/schema'
import { createEmptyProject } from '../project/schema'

const blobEnv = {
  connectionString: 'x',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'a',
  accountKey: 'k',
}

const emptyProject = (): StudioProject =>
  createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })

describe('spawnCutReviewStills (#596)', () => {
  it('reads PNG bytes from the worker JSON, not from in-process Remotion', () => {
    const stills = parseCutReviewWorkerResult(
      JSON.stringify({
        ok: true,
        stills: [{ frame: 0, bytesBase64: Buffer.from('png-bytes').toString('base64') }],
      }),
    )
    expect(stills).toEqual([{ frame: 0, bytes: Buffer.from('png-bytes') }])
  })

  it('spawns the cut-review CLI instead of bundling Remotion here', async () => {
    const calls: string[][] = []
    const stills = await spawnCutReviewStills({
      project: emptyProject(),
      blobEnv,
      frames: [0, 30],
      spawnFn: (command, args) => {
        calls.push([command, ...(args ?? [])])
        const child = new EventEmitter() as EventEmitter & {
          stdin: { write: (chunk: string) => void; end: () => void }
          stdout: EventEmitter
          stderr: EventEmitter
        }
        child.stdin = { write: () => undefined, end: () => undefined }
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        queueMicrotask(() => {
          child.stdout.emit(
            'data',
            Buffer.from(
              JSON.stringify({
                ok: true,
                stills: [
                  { frame: 0, bytesBase64: Buffer.from('a').toString('base64') },
                  { frame: 30, bytesBase64: Buffer.from('b').toString('base64') },
                ],
              }),
            ),
          )
          child.emit('close', 0)
        })
        return child as never
      },
    })
    expect(calls[0]?.join(' ')).toMatch(/creative-cut-review/)
    expect(stills.map((row) => row.frame)).toEqual([0, 30])
    expect(stills[0]?.bytes.equals(Buffer.from('a'))).toBe(true)
  })
})
