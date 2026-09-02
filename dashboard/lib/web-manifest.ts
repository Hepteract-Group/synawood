import type { MetadataRoute } from 'next'
import { PRODUCT_NAME } from './product-name'

/** Installable, online-only PWA (#842 / ADR-0078). No service worker. */

export const PWA_NAME = PRODUCT_NAME
export const PWA_SHORT_NAME = PRODUCT_NAME
export const PWA_START_URL = '/home'
export const PWA_BACKGROUND = '#0c0e11'
export const PWA_THEME = '#4c8dff'

export const buildWebManifest = (): MetadataRoute.Manifest => ({
  name: PWA_NAME,
  short_name: PWA_SHORT_NAME,
  description: 'Chat to ship weekly video ads without hiring an editor.',
  id: '/',
  start_url: PWA_START_URL,
  scope: '/',
  display: 'standalone',
  background_color: PWA_BACKGROUND,
  theme_color: PWA_THEME,
  icons: [
    {
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-192-maskable.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icons/icon-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
})
