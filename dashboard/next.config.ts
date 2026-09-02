import path from 'node:path'
import type { NextConfig } from 'next'
import { STUDIO_UPLOAD_MAX_CONFIG } from './lib/studio-upload-limits'

const nextConfig: NextConfig = {
  // Local review uses both localhost and 127.0.0.1; keep HMR/assets working across them.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: [
    '@synawood/creative',
    '@synawood/channels',
    'remotion',
    '@remotion/player',
    '@remotion/media-utils',
    '@remotion/lottie',
    '@remotion/transitions',
    '@remotion/shapes',
    '@remotion/three',
  ],
  // Never webpack-bundle Remotion encode/bundler (native .node binaries + nested webpack).
  serverExternalPackages: [
    '@remotion/renderer',
    '@remotion/bundler',
    '@remotion/compositor-darwin-arm64',
    '@remotion/compositor-darwin-x64',
    '@remotion/compositor-linux-x64-gnu',
    '@remotion/compositor-linux-arm64-gnu',
    '@remotion/compositor-win32-x64-msvc',
    '@rspack/core',
    '@rspack/binding',
    '@rspack/binding-darwin-arm64',
  ],
  outputFileTracingRoot: path.join(__dirname, '..'),
  // Middleware clones bodies for protected `/api/*` (incl. `/api/studio/assets`).
  // Default is 10MB — truncating video uploads → "Failed to parse body as FormData".
  experimental: {
    middlewareClientMaxBodySize: STUDIO_UPLOAD_MAX_CONFIG,
  },
}

export default nextConfig
