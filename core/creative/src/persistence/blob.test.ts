import { describe, expect, it } from 'vitest'
import { parseConnectionStringParts, readBlobEnv, resolveBlobConnectionString } from './blob'

describe('readBlobEnv (#479)', () => {
  it('parses a full connection string', () => {
    const env = readBlobEnv({
      AZURE_STORAGE_CONNECTION_STRING:
        'DefaultEndpointsProtocol=https;AccountName=stmktgo;AccountKey=abc123==;EndpointSuffix=core.windows.net',
      AZURE_STORAGE_CONTAINER: 'marketing-os',
      AZURE_BLOB_LOCAL_PREFIX: 'true',
    })
    expect(env.accountName).toBe('stmktgo')
    expect(env.accountKey).toBe('abc123==')
    expect(env.useLocalPrefix).toBe(true)
  })

  it('recovers from a truncated shell export when account env vars are set', () => {
    const resolved = resolveBlobConnectionString({
      AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https',
      AZURE_STORAGE_ACCOUNT_NAME: 'stmktgo',
      AZURE_STORAGE_ACCOUNT_KEY: 'abc123==',
    })
    expect(resolved.accountName).toBe('stmktgo')
    expect(resolved.connectionString).toMatch(/AccountName=stmktgo/)
    expect(resolved.connectionString).toMatch(/AccountKey=abc123==/)
  })

  it('explains truncated shell exports when credentials are missing', () => {
    expect(() =>
      readBlobEnv({
        AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https',
      }),
    ).toThrow(/parsed keys: DefaultEndpointsProtocol/)
    expect(() =>
      readBlobEnv({
        AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https',
      }),
    ).toThrow(/Unset any shell export/)
  })

  it('lists parsed keys for incomplete strings', () => {
    expect(Object.keys(parseConnectionStringParts('DefaultEndpointsProtocol=https'))).toEqual([
      'DefaultEndpointsProtocol',
    ])
  })
})
