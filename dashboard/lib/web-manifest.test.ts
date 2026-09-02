import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildWebManifest, PWA_SHORT_NAME, PWA_START_URL } from './web-manifest'

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47])

describe('web app manifest (#842)', () => {
  it('is standalone, starts at /home, and names Synawood', () => {
    const manifest = buildWebManifest()
    expect(manifest.name).toBe('Synawood')
    expect(manifest.short_name).toBe(PWA_SHORT_NAME)
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe(PWA_START_URL)
    expect(manifest.theme_color).toBe('#4c8dff')
    expect(manifest.background_color).toBe('#0c0e11')
    expect(manifest.icons?.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })

  it('ships 192/512 and Apple touch PNGs', () => {
    const root = join(process.cwd(), 'public')
    for (const rel of [
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/icon-192-maskable.png',
      'icons/icon-512-maskable.png',
      'apple-touch-icon.png',
    ]) {
      const bytes = readFileSync(join(root, rel))
      expect(bytes.subarray(0, 4).equals(pngMagic)).toBe(true)
    }
  })

  it('does not register a service worker or next-pwa', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
    expect(config).not.toMatch(/next-pwa|workbox|serviceWorker/)
    expect(layout).not.toMatch(/serviceWorker|service-worker|sw\.js/)
    expect(existsSync(join(process.cwd(), 'public/sw.js'))).toBe(false)
  })
})
