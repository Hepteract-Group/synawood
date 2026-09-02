import { randomUUID } from 'node:crypto'
import { deleteBlob, getBlobText, putBlob, readBlobEnv } from './blob'

const main = async () => {
  const blobEnv = readBlobEnv()
  const marker = `smoke-${randomUUID()}`
  const { blobKey } = await putBlob({
    blobEnv,
    productId: 'demo',
    kind: 'uploads',
    parts: ['smoke', `${marker}.txt`],
    data: `marketing-os blob smoke ${marker}`,
    contentType: 'text/plain',
  })
  const text = await getBlobText({ blobEnv, blobKey })
  if (!text.includes(marker)) {
    throw new Error(`Smoke read mismatch for ${blobKey}`)
  }
  await deleteBlob({ blobEnv, blobKey })
  console.log(`Blob smoke OK: ${blobKey}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
