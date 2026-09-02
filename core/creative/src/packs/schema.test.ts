import { describe, expect, it } from 'vitest'
import { packManifestSchema, mapPackCatalogRow, mapPackInstallRow } from './schema'

describe('pack schema (#285)', () => {
  it('parses a skill pack manifest', () => {
    const manifest = packManifestSchema.parse({
      id: 'hooks-first-3s',
      slug: 'hooks-first-3s',
      kind: 'skill',
      semver: '1.0.0',
      title: 'Hooks first 3s',
      entries: ['SKILL.md'],
      requiresConfirmSpend: true,
    })
    expect(manifest.mosApiVersion).toBe(1)
    expect(manifest.kind).toBe('skill')
  })

  it('maps a catalog row', () => {
    const pack = mapPackCatalogRow({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      slug: 'hooks-first-3s',
      kind: 'skill',
      title: 'Hooks first 3s',
      summary: 'Hook craft',
      publisher: 'hepteract',
      status: 'published',
      created_at: '2026-08-16T00:00:00.000Z',
      updated_at: '2026-08-16T00:00:00.000Z',
    })
    expect(pack.slug).toBe('hooks-first-3s')
    expect(pack.status).toBe('published')
  })
})

describe('pack install row (#954)', () => {
  it('maps a Product install and rejects product+user together', () => {
    const install = mapPackInstallRow({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      product_id: 'demo',
      user_id: null,
      pack_version_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      enabled: true,
      installed_at: '2026-08-24T00:00:00.000Z',
      disabled_at: null,
    })
    expect(install.productId).toBe('demo')
    expect(install.userId).toBeNull()
    expect(() =>
      mapPackInstallRow({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        product_id: 'demo',
        user_id: '11111111-1111-4111-8111-111111111111',
        pack_version_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        enabled: true,
        installed_at: '2026-08-24T00:00:00.000Z',
        disabled_at: null,
      }),
    ).toThrow(/Product-scoped or Account-scoped/)
  })
})
