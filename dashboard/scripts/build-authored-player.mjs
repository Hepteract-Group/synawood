import * as esbuild from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UNIQUE_ORIGIN_STORAGE_POLYFILL } from '@synawood/creative/authored/client'

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(dashboardRoot, 'app/authored-player/authored-player-entry.tsx')
const publicDir = path.join(dashboardRoot, 'public')
const htmlOut = path.join(publicDir, 'authored-player.html')
const jsOut = path.join(publicDir, 'authored-player.js')

const result = await esbuild.build({
  absWorkingDir: dashboardRoot,
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
})

const js = result.outputFiles[0]?.text
if (!js) throw new Error('esbuild produced no authored-player bundle')

const wrapped = `try {
${js}
} catch (error) {
  try {
    parent.postMessage({
      type: 'mos-authored:error',
      message: String(error && error.stack ? error.stack : error),
    }, '*')
  } catch (ignored) {}
}
`

const hash = createHash('sha256').update(wrapped).digest('hex').slice(0, 8)
const scriptSrc = `/authored-player.js?h=${hash}`

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Motion preview</title>
  <style>
    html,body,#root,.authored-player-frame { position:fixed; inset:0; width:100%; height:100%; margin:0; background:#05070a; overflow:hidden; }
    .authored-player-error { margin:0; padding:1rem; color:#f4f1ea; font-size:0.9rem; }
  </style>
  <script>${UNIQUE_ORIGIN_STORAGE_POLYFILL}</script>
  <script>
    window.onerror = function (message) {
      try { parent.postMessage({ type: 'mos-authored:error', message: String(message) }, '*') } catch (e) {}
    }
    window.onunhandledrejection = function (event) {
      try { parent.postMessage({ type: 'mos-authored:error', message: String(event.reason) }, '*') } catch (e) {}
    }
  </script>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptSrc}"></script>
</body>
</html>
`

mkdirSync(publicDir, { recursive: true })
writeFileSync(jsOut, wrapped)
writeFileSync(htmlOut, html)
console.log(
  `wrote ${path.relative(dashboardRoot, htmlOut)} (${html.length} bytes) and ${path.relative(dashboardRoot, jsOut)} (${js.length} bytes)`,
)
