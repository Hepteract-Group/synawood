/** Short-lived signed proof that this user already passed the app gate. */

export const ACCESS_GATE_COOKIE = 'mos-access-gate'
export const ACCESS_GATE_TTL_MS = 90_000

/** Options to expire the access-gate cookie (call after membership changes). */
export const clearAccessGateCookieOptions = (): {
  name: string
  value: string
  options: {
    httpOnly: boolean
    sameSite: 'lax'
    path: string
    maxAge: number
    secure: boolean
  }
} => ({
  name: ACCESS_GATE_COOKIE,
  value: '',
  options: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production',
  },
})

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

const utf8 = (value: string): ArrayBuffer => {
  const bytes = new TextEncoder().encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

const sign = async (secret: string, payload: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, utf8(payload))
  return bytesToBase64Url(new Uint8Array(signature))
}

const signaturesMatch = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return diff === 0
}

export const sealAccessGate = async (input: {
  userId: string
  membershipCount: number
  allowed: boolean
  secret: string
  now?: number
  profileComplete?: boolean
}): Promise<string> => {
  const now = input.now ?? Date.now()
  const exp = now + ACCESS_GATE_TTL_MS
  const allowedFlag = input.allowed ? '1' : '0'
  const profileFlag = input.profileComplete ? '1' : '0'
  const payload = `${input.userId}.${input.membershipCount}.${allowedFlag}.${profileFlag}.${exp}`
  const signature = await sign(input.secret, payload)
  return `${payload}.${signature}`
}

export const unsealAccessGate = async (
  token: string,
  input: { userId: string; secret: string; now?: number },
): Promise<{ membershipCount: number; allowed: boolean; profileComplete?: boolean } | null> => {
  const now = input.now ?? Date.now()
  const lastDot = token.lastIndexOf('.')
  if (lastDot <= 0) return null
  const payload = token.slice(0, lastDot)
  const signature = token.slice(lastDot + 1)
  const parts = payload.split('.')
  if (parts.length !== 4 && parts.length !== 5) return null
  const userId = parts[0]
  const countRaw = parts[1]
  const allowedFlag = parts[2]
  const profileFlag = parts.length === 5 ? parts[3] : undefined
  const expRaw = parts.length === 5 ? parts[4] : parts[3]
  if (userId !== input.userId) return null
  const membershipCount = Number(countRaw)
  const exp = Number(expRaw)
  if (!Number.isFinite(membershipCount) || !Number.isFinite(exp) || exp <= now) return null
  if (allowedFlag !== '0' && allowedFlag !== '1') return null
  if (profileFlag !== undefined && profileFlag !== '0' && profileFlag !== '1') return null
  if (!input.secret) return null
  const expected = await sign(input.secret, payload)
  if (!signaturesMatch(signature, expected)) return null
  return {
    membershipCount,
    allowed: allowedFlag === '1',
    ...(profileFlag !== undefined ? { profileComplete: profileFlag === '1' } : {}),
  }
}
