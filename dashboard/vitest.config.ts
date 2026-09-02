import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: [
      // Deep imports first (`@synawood/creative/project/asset-token`), then package root.
      {
        find: /^@synawood\/creative\/(.*)$/,
        replacement: path.resolve(__dirname, '../core/creative/src/$1'),
      },
      {
        find: '@synawood/creative',
        replacement: path.resolve(__dirname, '../core/creative/src/index.ts'),
      },
      {
        find: /^@synawood\/channels\/(.*)$/,
        replacement: path.resolve(__dirname, '../core/channels/src/$1'),
      },
      {
        find: '@synawood/channels',
        replacement: path.resolve(__dirname, '../core/channels/src/index.ts'),
      },
    ],
  },
})
