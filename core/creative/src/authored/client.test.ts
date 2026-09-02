import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const clientSrc = readFileSync(fileURLToPath(new URL('./client.ts', import.meta.url)), 'utf8')

describe('authored/client', () => {
  it('does not re-export the Node compiler or bundler', () => {
    expect(clientSrc).not.toMatch(/from ['"]\.\/compile['"]/)
    expect(clientSrc).not.toMatch(/from ['"]\.\/bundle-for-render['"]/)
    expect(clientSrc).not.toMatch(/from ['"]\.\/scan['"]/)
    expect(clientSrc).not.toMatch(/node:fs/)
  })
})
