#!/usr/bin/env node
/**
 * Isolated Remotion stills for inspect_preview (ADR-0051 / #596).
 *
 * Usage (stdin JSON `{ project, frames }`, stdout JSON stills):
 *   node --import tsx automations/creative-cut-review.ts
 *
 * Must run as a child process. Remotion `bundle()` cannot run inside Next.js.
 */
import { readBlobEnv } from '../core/creative/src/index.ts'
import { renderCutReviewStills } from '../core/creative/src/critic/render-cut-stills.ts'
import { studioProjectSchema } from '../core/creative/src/project/schema.ts'

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

const main = async () => {
  const raw = JSON.parse(await readStdin()) as { project?: unknown; frames?: unknown }
  const project = studioProjectSchema.parse(raw.project)
  const frames = Array.isArray(raw.frames)
    ? raw.frames.map((frame) => Number(frame)).filter((frame) => Number.isFinite(frame))
    : []
  const stills = await renderCutReviewStills({
    project,
    blobEnv: readBlobEnv(process.env),
    frames,
  })
  process.stdout.write(
    JSON.stringify({
      ok: true,
      stills: stills.map((row) => ({
        frame: row.frame,
        bytesBase64: row.bytes.toString('base64'),
      })),
    }),
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.stdout.write(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
})
