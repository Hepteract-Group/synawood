import { lookup as dnsLookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'

export type HostLookup = (hostname: string) => Promise<LookupAddress[]>

const IPV4_PRIVATE = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
  /^172\.(1[6-9]|2\d|3[0-1])\./,
]

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
])

export const isPrivateOrReservedIp = (ip: string): boolean => {
  const normalized = ip.trim().toLowerCase()
  if (!normalized) return true
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
  if (
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true
  }
  // IPv4-mapped IPv6
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped?.[1]) return isPrivateOrReservedIp(mapped[1])
  return IPV4_PRIVATE.some((re) => re.test(normalized))
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

/**
 * Fail closed for SSRF: https/http only, no credentials, no private/link-local targets.
 * Resolves DNS and checks every address.
 */
export const assertSafeFetchUrl = async (
  raw: string,
  options?: { lookup?: HostLookup },
): Promise<URL> => {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new UnsafeUrlError('Invalid URL')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new UnsafeUrlError(`Blocked protocol: ${parsed.protocol}`)
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError('URLs with credentials are blocked')
  }

  const host = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new UnsafeUrlError(`Blocked hostname: ${host}`)
  }

  // Literal IP in hostname
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    if (isPrivateOrReservedIp(host)) {
      throw new UnsafeUrlError(`Blocked IP address: ${host}`)
    }
    return parsed
  }

  const lookup = options?.lookup ?? ((hostname: string) => dnsLookup(hostname, { all: true }))
  let addresses: LookupAddress[]
  try {
    addresses = await lookup(host)
  } catch {
    throw new UnsafeUrlError(`DNS lookup failed for ${host}`)
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError(`No DNS addresses for ${host}`)
  }
  for (const entry of addresses) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw new UnsafeUrlError(`Blocked resolved address ${entry.address} for ${host}`)
    }
  }
  return parsed
}
