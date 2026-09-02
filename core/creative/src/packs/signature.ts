/** Pack artifact checksum + Ed25519 signatures (ADR-0039 / #286). */

import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto'

export const sha256Hex = (bytes: Buffer | Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex')

/** Canonical payload signed for a pack version: checksum + newline + semver. */
export const packSignaturePayload = (input: { checksumSha256: string; semver: string }): Buffer =>
  Buffer.from(`${input.checksumSha256}\n${input.semver}`, 'utf8')

export const generatePackSigningKeyPair = (): {
  publicKeyPem: string
  privateKeyPem: string
} => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

export const signPackChecksum = (input: {
  checksumSha256: string
  semver: string
  privateKeyPem: string
}): string => {
  const payload = packSignaturePayload(input)
  const signature = sign(null, payload, input.privateKeyPem)
  return signature.toString('base64')
}

export const verifyPackSignature = (input: {
  checksumSha256: string
  semver: string
  signatureBase64: string
  publicKeyPem: string
}): boolean => {
  try {
    const payload = packSignaturePayload(input)
    const signature = Buffer.from(input.signatureBase64, 'base64')
    return verify(null, payload, input.publicKeyPem, signature)
  } catch {
    return false
  }
}

export const assertPackIntegrity = (input: {
  bytes: Buffer | Uint8Array
  expectedChecksumSha256: string
  semver: string
  signatureBase64?: string | null
  publicKeyPem?: string | null
  allowUnsigned?: boolean
}): void => {
  const actual = sha256Hex(input.bytes)
  if (actual !== input.expectedChecksumSha256) {
    throw new Error(
      `Pack checksum mismatch (expected ${input.expectedChecksumSha256.slice(0, 12)}…, got ${actual.slice(0, 12)}…).`,
    )
  }
  const signature = input.signatureBase64?.trim()
  if (!signature) {
    if (input.allowUnsigned) return
    throw new Error('Pack signature required (set allowUnsigned only for local/dev).')
  }
  const publicKeyPem = input.publicKeyPem?.trim()
  if (!publicKeyPem) {
    throw new Error('Pack public key required to verify signature.')
  }
  const ok = verifyPackSignature({
    checksumSha256: input.expectedChecksumSha256,
    semver: input.semver,
    signatureBase64: signature,
    publicKeyPem,
  })
  if (!ok) {
    throw new Error('Pack signature verification failed.')
  }
}
