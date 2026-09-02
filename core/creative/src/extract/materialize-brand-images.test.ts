import { describe, expect, it, vi } from 'vitest'
import {
  isSubstantialLogoBytes,
  materializeExtractBrandImages,
  MIN_RASTER_LOGO_BYTES,
} from './materialize-brand-images'

vi.mock('../persistence/blob', () => ({
  putBlob: vi.fn(async (input: { parts: string[] }) => ({
    blobKey: `local/marketing-os/demo/brand-kit/${input.parts.join('/')}`,
  })),
  deleteBlob: vi.fn(async () => undefined),
}))

const blobEnv = {
  connectionString: 'UseDevelopmentStorage=true',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'dev',
  accountKey: 'key',
}

const mockSupabase = () => {
  const inserted: unknown[] = []
  return {
    inserted,
    supabase: {
      from: () => ({
        insert: async (row: unknown) => {
          inserted.push(row)
          return { error: null }
        },
      }),
    },
  }
}

describe('isSubstantialLogoBytes', () => {
  it('treats SVG as substantial even when tiny', () => {
    expect(
      isSubstantialLogoBytes({
        bytes: Buffer.from('<svg/>'),
        contentType: 'image/svg+xml',
        url: 'https://example.com/icon.svg',
      }),
    ).toBe(true)
  })

  it('rejects tiny rasters below the favicon floor', () => {
    expect(
      isSubstantialLogoBytes({
        bytes: Buffer.alloc(500),
        contentType: 'image/png',
        url: 'https://example.com/favicon.png',
      }),
    ).toBe(false)
    expect(
      isSubstantialLogoBytes({
        bytes: Buffer.alloc(MIN_RASTER_LOGO_BYTES),
        contentType: 'image/png',
        url: 'https://example.com/icon.png',
      }),
    ).toBe(true)
  })
})

describe('materializeExtractBrandImages', () => {
  it('uses substantial SVG icon as logo and og as still', async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#2244aa" width="10" height="10"/></svg>`,
    )
    const og = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#cc5522" width="10" height="10"/></svg>`,
    )

    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('icon')) {
        return new Response(svg, { status: 200, headers: { 'content-type': 'image/svg+xml' } })
      }
      return new Response(og, { status: 200, headers: { 'content-type': 'image/svg+xml' } })
    })

    const { supabase, inserted } = mockSupabase()
    const result = await materializeExtractBrandImages({
      supabase: supabase as never,
      blobEnv,
      productId: 'demo',
      projectId: '11111111-1111-1111-1111-111111111111',
      imageCandidates: [
        { url: 'https://example.com/icon.svg', role: 'icon' },
        { url: 'https://example.com/og.svg', role: 'og' },
      ],
      fetchImpl: fetchImpl as never,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    })

    expect(result.logoAsset?.id).not.toBe(result.stillAsset?.id)
    expect(result.sampledPrimaryColor).toBe('#2244aa')
    expect(result.sampledAccentColor).toBe('#cc5522')
    expect(inserted).toHaveLength(2)
  })

  it('skips tiny raster favicon and uses og:image as the only logo/still', async () => {
    const tinyIcon = Buffer.alloc(400, 1)
    const richOg = Buffer.concat([
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#e85a9b" width="200" height="200"/></svg>`,
      ),
      Buffer.alloc(MIN_RASTER_LOGO_BYTES, 2),
    ])

    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('favicon')) {
        return new Response(tinyIcon, { status: 200, headers: { 'content-type': 'image/png' } })
      }
      return new Response(richOg, { status: 200, headers: { 'content-type': 'image/svg+xml' } })
    })

    const { supabase, inserted } = mockSupabase()
    const result = await materializeExtractBrandImages({
      supabase: supabase as never,
      blobEnv,
      productId: 'demo',
      projectId: '11111111-1111-1111-1111-111111111111',
      imageCandidates: [
        { url: 'https://example.com/favicon.png', role: 'icon' },
        { url: 'https://example.com/og-logo.svg', role: 'og' },
      ],
      fetchImpl: fetchImpl as never,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    })

    expect(inserted).toHaveLength(1)
    expect(result.logoAsset?.id).toBe(result.stillAsset?.id)
    expect(result.logoAsset?.probe).toMatchObject({ candidateRole: 'og' })
    expect(result.sampledPrimaryColor).toBe('#e85a9b')
  })
})
