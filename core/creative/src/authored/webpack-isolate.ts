import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Webpack config shape we actually touch — avoid importing webpack from Next. */
export type IsolateWebpackConfig = {
  plugins?: unknown[]
  resolve?: { alias?: Record<string, string | false> }
}

const MOTION_KIT_ENTRY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../motion-kit/index.ts',
)

const isEnvInliner = (plugin: unknown): boolean => {
  if (!plugin || typeof plugin !== 'object') return false
  const record = plugin as {
    constructor?: { name?: string }
    definitions?: Record<string, string>
  }
  const name = record.constructor?.name ?? ''
  if (name === 'EnvironmentPlugin' || name.includes('DefinePlugin')) return true
  const keys = Object.keys(record.definitions ?? {})
  return keys.some((key) => key === 'process.env' || key.startsWith('process.env.'))
}

/**
 * Strip env inlining. Remotion's bundler may attach DefinePlugin with process.env.*.
 * Authored compiles must not embed Azure / Supabase / Postiz secrets.
 */
export const isolateAuthoredWebpackConfig = <T extends IsolateWebpackConfig>(config: T): T => {
  const plugins = (config.plugins ?? []).filter((plugin) => !isEnvInliner(plugin))

  return {
    ...config,
    plugins,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        fs: false,
        'node:fs': false,
        child_process: false,
        'node:child_process': false,
        worker_threads: false,
        '@synawood/creative/motion-kit': MOTION_KIT_ENTRY,
      },
    },
  }
}
