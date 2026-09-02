import { describe, expect, it } from 'vitest'
import {
  buildUnsignedLocalArtifact,
  decodePackArtifact,
  encodePackArtifact,
  entriesFromArtifact,
} from './install'
import { assertPackSafe } from './safety'
import type { PackManifest } from './schema'

const manifest: PackManifest = {
  id: 'hooks-first-3s',
  slug: 'hooks-first-3s',
  kind: 'skill',
  semver: '1.0.0',
  mosApiVersion: 1,
  title: 'Hooks',
  entries: ['SKILL.md'],
  requiresConfirmSpend: true,
}

describe('pack install artifact (#288)', () => {
  it('round-trips JSON envelope and passes safety', () => {
    const { bytes, checksumSha256, envelope } = buildUnsignedLocalArtifact(manifest, {
      'SKILL.md': '# Hooks\n',
    })
    expect(checksumSha256).toHaveLength(64)
    const decoded = decodePackArtifact(bytes)
    expect(decoded.manifest.slug).toBe('hooks-first-3s')
    expect(encodePackArtifact(envelope).equals(bytes)).toBe(true)
    expect(() =>
      assertPackSafe({
        entries: entriesFromArtifact(decoded),
        manifestRaw: decoded.manifest,
      }),
    ).not.toThrow()
  })
})
