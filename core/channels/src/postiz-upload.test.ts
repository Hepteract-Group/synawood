import { describe, expect, it } from 'vitest'
import { createMockPostizFetch } from './postiz-mock-http'
import { uploadFinalBlobToPostiz, uploadPostizMedia } from './postiz-upload'

const bytes = Buffer.from('fake-mp4-bytes')
const liveEnv = {
  baseUrl: 'https://api.postiz.com/public/v1',
  apiKey: 'pos_secret_do_not_log',
}

describe('Postiz multipart upload (#800)', () => {
  it('POSTs server-read bytes as multipart file, not base64 or upload-from-url', async () => {
    const { fetchImpl, requests } = createMockPostizFetch()

    const result = await uploadPostizMedia({
      ...liveEnv,
      bytes,
      filename: 'final.mp4',
      contentType: 'video/mp4',
      fetchImpl,
    })

    expect(result).toEqual({ id: 'img-123', path: 'https://uploads.postiz.com/final.mp4' })
    const request = requests[0]
    expect(request?.method).toBe('POST')
    expect(request?.url).toBe('https://api.postiz.com/public/v1/upload')
    expect(request?.url).not.toMatch(/upload-from-url/)
    expect(request?.headers.get('Authorization')).toBe(liveEnv.apiKey)
    expect(request?.headers.get('Content-Type') ?? '').not.toMatch(/application\/json/)

    const form = await request!.formData()
    const file = form.get('file')
    expect(file).toBeInstanceOf(File)
    const uploaded = file as File
    expect(uploaded.name).toBe('final.mp4')
    expect(uploaded.type).toBe('video/mp4')
    expect(Buffer.from(await uploaded.arrayBuffer()).equals(bytes)).toBe(true)
  })

  it('reads Final bytes from Blob via an injected SDK reader', async () => {
    const readBytes = async (blobKey: string) => {
      expect(blobKey).toBe('products/demo/finals/ad.mp4')
      return bytes
    }
    const { fetchImpl } = createMockPostizFetch({
      upload: { id: 'img-9', path: 'https://uploads.postiz.com/ad.mp4' },
    })

    const result = await uploadFinalBlobToPostiz({
      ...liveEnv,
      blobKey: 'products/demo/finals/ad.mp4',
      filename: 'ad.mp4',
      contentType: 'video/mp4',
      readBytes,
      fetchImpl,
    })

    expect(result.id).toBe('img-9')
  })

  it('throws a loud error without echoing the API key when upload fails', async () => {
    const { fetchImpl } = createMockPostizFetch({ uploadStatus: 413 })

    try {
      await uploadPostizMedia({
        ...liveEnv,
        bytes,
        filename: 'final.mp4',
        contentType: 'video/mp4',
        fetchImpl,
      })
      throw new Error('expected upload to fail')
    } catch (error) {
      expect(String(error)).toMatch(/multipart/)
      expect(String(error)).not.toContain(liveEnv.apiKey)
    }
  })
})
