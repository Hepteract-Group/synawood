import { describe, expect, it, vi } from 'vitest'
import { UnsafeUrlError } from '../extract/ssrf'
import { ingestProjectAssetFromUrl, UrlAssetIngestError } from './ingest-asset-from-url'

vi.mock('./upload-asset', () => ({
  uploadProjectAsset: vi.fn(async (input: { fileName: string; source?: string; data: Buffer }) => ({
    asset: {
      id: 'asset-1',
      kind: 'image' as const,
      blobKey: 'local/uploads/a.jpg',
      contentType: 'image/jpeg',
      source: input.source ?? 'upload',
      probe: { name: input.fileName },
    },
    project: { id: 'proj', revision: 2 },
  })),
}))

vi.mock('../extract/fetch-safe-bytes', () => ({
  fetchSafeBytes: vi.fn(),
}))

import { fetchSafeBytes } from '../extract/fetch-safe-bytes'
import { uploadProjectAsset } from './upload-asset'

describe('ingestProjectAssetFromUrl (#108)', () => {
  it('rejects empty URL', async () => {
    await expect(
      ingestProjectAssetFromUrl({
        supabase: {} as never,
        blobEnv: {} as never,
        projectId: 'p',
        expectedRevision: 1,
        url: '   ',
      }),
    ).rejects.toBeInstanceOf(UrlAssetIngestError)
  })

  it('maps SSRF failures to ingest errors', async () => {
    vi.mocked(fetchSafeBytes).mockRejectedValueOnce(
      new UnsafeUrlError('Blocked hostname: localhost'),
    )
    await expect(
      ingestProjectAssetFromUrl({
        supabase: {} as never,
        blobEnv: {} as never,
        projectId: 'p',
        expectedRevision: 1,
        url: 'http://localhost/x.jpg',
      }),
    ).rejects.toMatchObject({ message: 'Blocked hostname: localhost' })
  })

  it('stores image bytes via upload with source url', async () => {
    vi.mocked(fetchSafeBytes).mockResolvedValueOnce({
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: 'image/jpeg',
      finalUrl: 'https://cdn.example.com/path/hero.jpg',
    })
    const result = await ingestProjectAssetFromUrl({
      supabase: {} as never,
      blobEnv: {} as never,
      projectId: 'p',
      expectedRevision: 1,
      url: 'https://cdn.example.com/path/hero.jpg',
    })
    expect(result.finalUrl).toContain('hero.jpg')
    expect(uploadProjectAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'url',
        kind: 'image',
        fileName: 'hero.jpg',
        contentType: 'image/jpeg',
        probeExtras: expect.objectContaining({
          sourceUrl: 'https://cdn.example.com/path/hero.jpg',
        }),
      }),
    )
  })

  it('rejects non-image content types', async () => {
    vi.mocked(fetchSafeBytes).mockResolvedValueOnce({
      bytes: Buffer.from('not-image'),
      contentType: 'text/html',
      finalUrl: 'https://example.com/page',
    })
    await expect(
      ingestProjectAssetFromUrl({
        supabase: {} as never,
        blobEnv: {} as never,
        projectId: 'p',
        expectedRevision: 1,
        url: 'https://example.com/page',
      }),
    ).rejects.toBeInstanceOf(UrlAssetIngestError)
  })
})
