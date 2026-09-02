import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Syne, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { PRODUCT_NAME } from '../lib/product-name'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-sw-display',
  display: 'swap',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sw-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sw-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: 'Chat to ship weekly video ads without hiring an editor.',
  applicationName: PRODUCT_NAME,
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME,
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4c8dff',
}

type RootLayoutProps = {
  children: ReactNode
}

const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en" className={`${syne.variable} ${plexSans.variable} ${plexMono.variable}`}>
    <body>{children}</body>
  </html>
)

export default RootLayout
