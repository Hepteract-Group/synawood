import {
  getBlobByteRange,
  getBlobBytes,
  getBlobContentLength,
  isSvgContentType,
  sanitizeSvgBytes,
} from '@synawood/creative'
import { loadProject, resolveProjectAsset } from '@synawood/creative/project'
import { parseBytesRange } from '@/lib/parse-bytes-range'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

/** Cap open-ended Range reads so a single metadata probe cannot pull a full multi‑GB file. */
const OPEN_RANGE_CHUNK = 2 * 1024 * 1024

export const GET = async (
  request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) => {
  try {
    const { projectId, assetId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase, blobEnv } = access
    const { project } = await loadProject(supabase, projectId)
    const asset = await resolveProjectAsset({ supabase, project, assetId })
    if (!asset) {
      return jsonError('Asset not found', 404)
    }

    const url = new URL(request.url)
    const variant = url.searchParams.get('variant')
    if (variant === 'poster') {
      const posterKey = asset.probe?.posterBlobKey
      if (typeof posterKey !== 'string' || !posterKey) {
        return jsonError('Poster not available', 404)
      }
      const bytes = await getBlobBytes({ blobEnv, blobKey: posterKey })
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    if (variant === 'shot') {
      const shotId = url.searchParams.get('shotId')
      if (!shotId || !/^[0-9a-f-]{36}$/i.test(shotId)) {
        return jsonError('shotId must be a uuid', 400)
      }
      const { data: shot, error: shotError } = await supabase
        .from('asset_shots')
        .select('thumb_blob_key')
        .eq('id', shotId)
        .eq('asset_id', assetId)
        .eq('product_id', project.productId)
        .maybeSingle()
      if (shotError) {
        throw new Error(`Failed to load shot thumb: ${shotError.message}`)
      }
      const thumbKey = shot?.thumb_blob_key
      if (typeof thumbKey !== 'string' || !thumbKey) {
        return jsonError('Shot thumb not available', 404)
      }
      const bytes = await getBlobBytes({ blobEnv, blobKey: thumbKey })
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    const contentType = asset.contentType ?? 'application/octet-stream'
    const isSvg = isSvgContentType(contentType) || asset.blobKey.toLowerCase().endsWith('.svg')
    const rangeHeader = request.headers.get('range')

    if (rangeHeader && !isSvg) {
      const totalSize = await getBlobContentLength({ blobEnv, blobKey: asset.blobKey })
      const parsed = parseBytesRange(rangeHeader, totalSize, OPEN_RANGE_CHUNK)
      if (!parsed) {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${totalSize}`,
          },
        })
      }
      const count = parsed.end - parsed.start + 1
      const { bytes } = await getBlobByteRange({
        blobEnv,
        blobKey: asset.blobKey,
        offset: parsed.start,
        count,
        totalSize,
      })
      return new Response(new Uint8Array(bytes), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(bytes.byteLength),
          'Content-Range': `bytes ${parsed.start}-${parsed.start + bytes.byteLength - 1}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=300',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    let bytes = await getBlobBytes({ blobEnv, blobKey: asset.blobKey })
    if (isSvg) {
      bytes = sanitizeSvgBytes(bytes)
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': isSvg ? 'image/svg+xml; charset=utf-8' : contentType,
        'Accept-Ranges': isSvg ? 'none' : 'bytes',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load asset')
  }
}
