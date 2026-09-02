import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compileAuthoredComposition } from './compile'
import { scanAuthoredSource } from './scan'
import { isolateAuthoredWebpackConfig } from './webpack-isolate'
import {
  authoredRequestAllowed,
  allowedOriginsFromInputProps,
  installAuthoredFetchGuardSource,
} from './network-allowlist'
import { authoredCompileBanner } from './banner'
import { AUTHORED_IFRAME_ALLOW, AUTHORED_IFRAME_SANDBOX } from './iframe-protocol'
import { LEGAL_AUTHORED_FIXTURE, LEGAL_KIT_FIXTURE } from './fixtures'

describe('authored compiler', () => {
  it('rejects node:fs imports with a line and plain English', () => {
    const source = `import fs from 'node:fs'\nexport default () => null\n`
    const result = compileAuthoredComposition(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.compileError).toMatch(/Line 1/)
    expect(result.compileError).toMatch(/Blocked import "node:fs"/)
    expect(result.compileError).not.toMatch(/EACCES|ENOENT/)
  })

  it('rejects unknown motion-kit named imports before the Player crashes (#1329)', () => {
    const source = `import { NotARealKitThing } from '@synawood/creative/motion-kit'\nexport default () => null\n`
    const result = compileAuthoredComposition(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.compileError).toMatch(/NotARealKitThing/)
    expect(result.compileError).toMatch(/list_motion_kit/)
  })

  it('rejects Math.random with a Remotion random hint', () => {
    const source = `import { AbsoluteFill } from 'remotion'\nexport default () => <AbsoluteFill style={{ opacity: Math.random() }} />\n`
    const result = scanAuthoredSource(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.compileError).toMatch(/random\(`\$\{motionSeed/)
  })

  it('rejects CSS transition with a frame-driven rewrite hint (does not strip)', () => {
    const source = `export default () => <div style={{ transition: 'opacity 300ms' }}>Hi</div>\n`
    const result = scanAuthoredSource(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.compileError).toMatch(/interpolate/)
    expect(result.compileError).toMatch(/fadeIn/)
    expect(source).toContain("transition: 'opacity 300ms'")
  })

  it('rejects CSS @keyframes with a frame-driven rewrite hint', () => {
    const source = `export default () => <style>{\`@keyframes spin { from { opacity: 0 } }\`}</style>\n`
    const result = scanAuthoredSource(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.compileError).toMatch(/interpolate/)
    expect(result.compileError).toMatch(/fadeIn/)
  })

  it('rejects document cookie via bracket access', () => {
    const source = `export default () => { const x = document['cookie']; return null }\n`
    const result = scanAuthoredSource(source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.compileError).toMatch(/document\.cookie is blocked/)
  })

  it('compiles legal spring + useCurrentFrame', () => {
    const result = compileAuthoredComposition(LEGAL_AUTHORED_FIXTURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toMatch(/useCurrentFrame/)
    expect(result.code).not.toMatch(/AZURE/)
    expect(result.code).not.toMatch(/SUPABASE/)
  })

  it('allows motion-kit imports', () => {
    const result = compileAuthoredComposition(LEGAL_KIT_FIXTURE)
    expect(result.ok).toBe(true)
  })

  it('allows @remotion/lottie and @remotion/transitions (#1193)', () => {
    const source = `import { Lottie } from '@remotion/lottie'
import { TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
export default () => null
`
    const result = compileAuthoredComposition(source)
    expect(result.ok).toBe(true)
  })

  it('allows @remotion/three (#1194)', () => {
    const source = `import { ThreeCanvas } from '@remotion/three'\nexport default () => null\n`
    const result = compileAuthoredComposition(source)
    expect(result.ok).toBe(true)
  })

  it('rejects guessed kit aliases and names the real import (#1261)', () => {
    for (const specifier of ['@motion-kit', '@remotion/motion-kit'] as const) {
      const source = `import { CountUp } from '${specifier}'\nexport default () => null\n`
      const result = compileAuthoredComposition(source)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.compileError).toMatch(/Line 1/)
      expect(result.compileError).toMatch(`Blocked import "${specifier}"`)
      expect(result.compileError).toMatch(/@synawood\/creative\/motion-kit/)
      expect(result.compileError).not.toMatch(/@remotion\/\*/)
    }
  })

  it('does not inline process.env secrets (no DefinePlugin)', () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'AccountKey=supersecret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb-secret'
    const result = compileAuthoredComposition(LEGAL_AUTHORED_FIXTURE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).not.toMatch(/supersecret/)
    expect(result.code).not.toMatch(/sb-secret/)
    expect(result.code).not.toMatch(/AZURE_STORAGE/)
  })
})

describe('isolateAuthoredWebpackConfig', () => {
  it('strips DefinePlugin so env secrets cannot be inlined', () => {
    const DefinePlugin = function DefinePlugin(this: { definitions: Record<string, string> }) {
      this.definitions = { 'process.env.AZURE_STORAGE_KEY': '"secret-from-define"' }
    }
    const plugin = new (
      DefinePlugin as unknown as new () => {
        constructor: { name: string }
        definitions: Record<string, string>
      }
    )()
    const isolated = isolateAuthoredWebpackConfig({
      plugins: [plugin],
    })
    expect(isolated.plugins).toEqual([])
    expect(JSON.stringify(isolated)).not.toMatch(/secret-from-define/)
  })

  it('aliases the motion kit so inspect/encode can resolve it (#1263)', () => {
    const isolated = isolateAuthoredWebpackConfig({
      resolve: { alias: {} as Record<string, string | false> },
    })
    const kit = isolated.resolve?.alias?.['@synawood/creative/motion-kit']
    expect(typeof kit).toBe('string')
    expect(String(kit)).toMatch(/motion-kit\/index\.tsx?$/)
    expect(existsSync(String(kit))).toBe(true)
  })
})

describe('authored network allowlist', () => {
  it('blocks evil.example and allows signed project asset origins', () => {
    const props = {
      heroSrc: 'https://blobs.example/sas?sig=1',
      logoSrc: 'https://blobs.example/logo',
    }
    const allowed = allowedOriginsFromInputProps(props)
    expect(authoredRequestAllowed('https://evil.example/steal', allowed)).toBe(false)
    expect(authoredRequestAllowed('https://blobs.example/sas?sig=1', allowed)).toBe(true)
    expect(authoredRequestAllowed('http://localhost:3000/bundle', allowed)).toBe(true)
    expect(authoredRequestAllowed('data:image/png;base64,xx', allowed)).toBe(true)
  })

  it('injects fetch and XHR guards into the render host', () => {
    const source = installAuthoredFetchGuardSource(['https://blobs.example'])
    expect(source).toMatch(/globalThis\.fetch/)
    expect(source).toMatch(/XMLHttpRequest/)
  })
})

describe('authored Player contract', () => {
  it('iframe sandbox is scripts-only (no allow-same-origin)', () => {
    expect(AUTHORED_IFRAME_SANDBOX).toBe('allow-scripts')
    expect(AUTHORED_IFRAME_SANDBOX).not.toMatch(/allow-same-origin/)
  })

  it('allows autoplay so parent Transport play can unmute iframe audio (#1257)', () => {
    expect(AUTHORED_IFRAME_ALLOW).toBe('autoplay')
  })

  it('maps compile errors to a banner under the player', () => {
    expect(authoredCompileBanner({ compiling: true })?.message).toBe('Building preview')
    expect(authoredCompileBanner({ compileError: 'Line 1: Blocked import "node:fs"' })?.kind).toBe(
      'blocked-import',
    )
    expect(authoredCompileBanner({ compileError: 'Line 4: Unexpected token' })?.message).toMatch(
      /didn't compile/,
    )
    expect(
      authoredCompileBanner({ runtimeError: 'The value 1.2 is outside of the range' })?.kind,
    ).toBe('runtime')
    expect(
      authoredCompileBanner({ runtimeError: 'The value 1.2 is outside of the range' })?.message,
    ).toMatch(/Playback stopped/)
    expect(authoredCompileBanner({ source: '' })?.kind).toBe('empty')
    expect(authoredCompileBanner({ source: LEGAL_AUTHORED_FIXTURE, compileError: null })).toBeNull()
    expect(
      authoredCompileBanner({
        source: LEGAL_AUTHORED_FIXTURE,
        voiceoverStartsAfterPicture: true,
      })?.kind,
    ).toBe('voiceover-late')
  })
})
