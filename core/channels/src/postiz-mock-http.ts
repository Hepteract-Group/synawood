import type { PostizUploadedMedia } from './postiz-upload'

export type MockPostizListPost = {
  id: string
  state: 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT'
  releaseURL?: string | null
}

export type MockPostizHttpOptions = {
  upload?: PostizUploadedMedia
  uploadStatus?: number
  createPost?: { postId: string; integration: string }
  createStatus?: number
  deleteStatus?: number
  listPosts?: MockPostizListPost[]
  listStatus?: number
}

/**
 * In-memory Postiz Public API. Tests inject this as `fetchImpl`. It never calls a host.
 * Read captured bodies with `await request.clone().json()` or `.formData()`.
 */
export const createMockPostizFetch = (options?: MockPostizHttpOptions) => {
  const requests: Request[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const path = new URL(request.url).pathname
    if (request.method === 'POST' && /\/upload$/.test(path)) {
      const status = options?.uploadStatus ?? 200
      if (status !== 200) {
        return new Response('payload too large', { status })
      }
      return Response.json(
        options?.upload ?? { id: 'img-123', path: 'https://uploads.postiz.com/final.mp4' },
      )
    }
    if (request.method === 'GET' && /\/posts$/.test(path)) {
      const status = options?.listStatus ?? 200
      if (status !== 200) {
        return new Response('error', { status })
      }
      return Response.json({ posts: options?.listPosts ?? [] })
    }
    if (request.method === 'POST' && /\/posts$/.test(path)) {
      const status = options?.createStatus ?? 200
      if (status !== 200) {
        return new Response(status === 429 ? 'slow down' : 'error', { status })
      }
      return Response.json([options?.createPost ?? { postId: 'pz_1', integration: 'int_li' }])
    }
    if (request.method === 'DELETE' && /\/posts\/[^/]+$/.test(path)) {
      const status = options?.deleteStatus ?? 200
      if (status === 404) return new Response('gone', { status: 404 })
      if (status !== 200) return new Response('error', { status })
      return Response.json({ id: path.split('/').pop() })
    }
    throw new Error(`Mock Postiz HTTP has no handler for ${request.method} ${request.url}`)
  }
  return { fetchImpl, requests }
}
