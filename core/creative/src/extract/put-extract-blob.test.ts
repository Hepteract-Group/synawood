import { describe, expect, it, vi } from 'vitest'

vi.mock('../persistence/blob', () => ({
  putBlob: vi.fn(async (input: { parts: string[]; contentType: string }) => ({
    blobKey: `local/marketing-os/acme/extract/${input.parts.join('/')}`,
  })),
}))

describe('putExtractBlob', () => {
  it('derives extension from content type when filename is omitted', async () => {
    const { putExtractBlob } = await import('./put-extract-blob')
    const { putBlob } = await import('../persistence/blob')
    const result = await putExtractBlob({
      blobEnv: {
        connectionString: 'x',
        containerName: 'marketing-os',
        useLocalPrefix: true,
        accountName: 'a',
        accountKey: 'k',
      },
      productId: 'acme',
      extractId: '11111111-1111-4111-8111-111111111111',
      kind: 'still',
      data: Buffer.from('png'),
      contentType: 'image/png',
    })
    expect(result.blobKey).toContain('/still.png')
    expect(putBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'extract',
        contentType: 'image/png',
      }),
    )
  })

  it('keeps an explicit filename extension', async () => {
    const { putExtractBlob } = await import('./put-extract-blob')
    const result = await putExtractBlob({
      blobEnv: {
        connectionString: 'x',
        containerName: 'marketing-os',
        useLocalPrefix: true,
        accountName: 'a',
        accountKey: 'k',
      },
      productId: 'acme',
      extractId: '11111111-1111-4111-8111-111111111111',
      kind: 'screenshot',
      data: Buffer.from('webp'),
      contentType: 'image/webp',
      filename: 'hero.webp',
    })
    expect(result.blobKey).toContain('/hero.webp')
  })

  it('falls back to bin for unknown content types', async () => {
    const { putExtractBlob } = await import('./put-extract-blob')
    const result = await putExtractBlob({
      blobEnv: {
        connectionString: 'x',
        containerName: 'marketing-os',
        useLocalPrefix: true,
        accountName: 'a',
        accountKey: 'k',
      },
      productId: 'acme',
      extractId: '11111111-1111-4111-8111-111111111111',
      kind: 'still',
      data: Buffer.from('x'),
      contentType: 'application/octet-stream',
    })
    expect(result.blobKey).toContain('/still.bin')
  })
})
