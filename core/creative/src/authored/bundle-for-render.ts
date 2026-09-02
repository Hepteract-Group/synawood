import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle, type WebpackOverrideFn } from '@remotion/bundler'
import { compileAuthoredComposition } from './compile'
import { isolateAuthoredWebpackConfig, type IsolateWebpackConfig } from './webpack-isolate'
import { installAuthoredFetchGuardSource, allowedOriginsFromInputProps } from './network-allowlist'
import type { AuthoredInputProps } from './input-props'

const wrapDir = path.dirname(fileURLToPath(import.meta.url))

export const isolateAuthoredWebpack: WebpackOverrideFn = (config) =>
  isolateAuthoredWebpackConfig(config as IsolateWebpackConfig) as typeof config

/**
 * Remotion webpack bundle for encode. Must not run inside a Next.js API route.
 */
export const bundleAuthoredForRender = async (input: {
  source: string
  workDir: string
  inputProps: AuthoredInputProps & {
    durationInFrames: number
    fps: number
    width: number
    height: number
  }
}): Promise<{ serveUrl: string }> => {
  const compiled = compileAuthoredComposition(input.source)
  if (!compiled.ok) {
    throw new Error(compiled.compileError)
  }

  await mkdir(input.workDir, { recursive: true })
  const userPath = path.join(input.workDir, 'user-source.tsx')
  const entryPath = path.join(input.workDir, 'entry.tsx')
  await writeFile(userPath, input.source, 'utf8')

  const origins = allowedOriginsFromInputProps(input.inputProps)
  const duration = input.inputProps.durationInFrames
  const fps = input.inputProps.fps
  const width = input.inputProps.width
  const height = input.inputProps.height

  const entry = `import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { AuthoredPathCWrap } from ${JSON.stringify(path.join(wrapDir, 'path-c-wrap.tsx'))}
import Authored from ${JSON.stringify(userPath)}

${installAuthoredFetchGuardSource(origins)}

const Wrapped = (props) => (
  React.createElement(AuthoredPathCWrap, props, React.createElement(Authored, props))
)

const Root = () => (
  React.createElement(Composition, {
    id: 'authored',
    component: Wrapped,
    durationInFrames: ${duration},
    fps: ${fps},
    width: ${width},
    height: ${height},
    defaultProps: {},
  })
)

registerRoot(Root)
`
  await writeFile(entryPath, entry, 'utf8')

  const serveUrl = await bundle({
    entryPoint: entryPath,
    webpackOverride: isolateAuthoredWebpack,
  })
  return { serveUrl }
}
