/** AES-256-GCM token storage (ADR-0035 / #239). Node-only. */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const KEY_ERROR = 'PERFORMANCE_TOKEN_KEY must be 32-byte hex (64 characters).'

export const readPerformanceTokenKey = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const raw = env.PERFORMANCE_TOKEN_KEY?.trim() ?? ''
  return raw.length > 0 ? raw : null
}

const keyBuffer = (keyHex: string): Buffer => {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(KEY_ERROR)
  }
  return Buffer.from(keyHex, 'hex')
}

export const encryptSecret = (
  plaintext: string,
  keyHex: string,
): { ciphertext: string; nonce: string } => {
  const key = keyBuffer(keyHex)
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
    nonce: nonce.toString('base64'),
  }
}

export const decryptSecret = (
  input: { ciphertext: string; nonce: string },
  keyHex: string,
): string => {
  const key = keyBuffer(keyHex)
  const nonce = Buffer.from(input.nonce, 'base64')
  const packed = Buffer.from(input.ciphertext, 'base64')
  if (packed.length < 17) throw new Error('Ciphertext is too short.')
  const tag = packed.subarray(packed.length - 16)
  const data = packed.subarray(0, packed.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
