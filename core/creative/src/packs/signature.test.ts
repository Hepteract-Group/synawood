import { describe, expect, it } from 'vitest'
import {
  assertPackIntegrity,
  generatePackSigningKeyPair,
  sha256Hex,
  signPackChecksum,
  verifyPackSignature,
} from './signature'

describe('pack signature (#286)', () => {
  it('checksums bytes', () => {
    expect(sha256Hex('hello')).toHaveLength(64)
    expect(sha256Hex('hello')).toBe(sha256Hex(Buffer.from('hello')))
  })

  it('signs and verifies a checksum payload', () => {
    const { publicKeyPem, privateKeyPem } = generatePackSigningKeyPair()
    const checksumSha256 = sha256Hex('pack-bytes')
    const signature = signPackChecksum({
      checksumSha256,
      semver: '1.0.0',
      privateKeyPem,
    })
    expect(
      verifyPackSignature({
        checksumSha256,
        semver: '1.0.0',
        signatureBase64: signature,
        publicKeyPem,
      }),
    ).toBe(true)
    expect(
      verifyPackSignature({
        checksumSha256,
        semver: '1.0.1',
        signatureBase64: signature,
        publicKeyPem,
      }),
    ).toBe(false)
  })

  it('assertPackIntegrity rejects tampered bytes', () => {
    const { publicKeyPem, privateKeyPem } = generatePackSigningKeyPair()
    const bytes = Buffer.from('good-pack')
    const checksumSha256 = sha256Hex(bytes)
    const signature = signPackChecksum({
      checksumSha256,
      semver: '1.0.0',
      privateKeyPem,
    })
    expect(() =>
      assertPackIntegrity({
        bytes: Buffer.from('evil-pack'),
        expectedChecksumSha256: checksumSha256,
        semver: '1.0.0',
        signatureBase64: signature,
        publicKeyPem,
      }),
    ).toThrow(/checksum mismatch/i)
  })

  it('allows unsigned only when flagged', () => {
    const bytes = Buffer.from('local')
    const checksumSha256 = sha256Hex(bytes)
    expect(() =>
      assertPackIntegrity({
        bytes,
        expectedChecksumSha256: checksumSha256,
        semver: '0.0.1',
      }),
    ).toThrow(/signature required/i)
    expect(() =>
      assertPackIntegrity({
        bytes,
        expectedChecksumSha256: checksumSha256,
        semver: '0.0.1',
        allowUnsigned: true,
      }),
    ).not.toThrow()
  })
})
