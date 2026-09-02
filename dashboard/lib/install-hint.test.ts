import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INSTALL_HINT_CHROME,
  INSTALL_HINT_IPHONE,
  INSTALL_HINT_LOGIN_BRIEF,
  INSTALL_HINT_ONLINE,
  INSTALL_HINT_STANDALONE,
  INSTALL_HINT_TITLE,
} from './install-hint'
import { PWA_START_URL } from './web-manifest'

const root = process.cwd()
const css = readFileSync(join(root, 'app/globals.css'), 'utf8')
const hint = readFileSync(join(root, 'components/InstallHint.tsx'), 'utf8')
const settings = readFileSync(join(root, 'app/(app)/settings/page.tsx'), 'utf8')
const login = readFileSync(join(root, 'app/login/login-form.tsx'), 'utf8')
const runbook = readFileSync(join(root, '../docs/pwa/README.md'), 'utf8')

describe('PWA install hint (#843)', () => {
  it('names iPhone Add to Home Screen and Chrome Install, not a campaign', () => {
    expect(INSTALL_HINT_TITLE).toBe('Install this app')
    expect(INSTALL_HINT_IPHONE).toMatch(/Share/)
    expect(INSTALL_HINT_IPHONE).toMatch(/Add to Home Screen/)
    expect(INSTALL_HINT_CHROME).toMatch(/Install/)
    expect(INSTALL_HINT_LOGIN_BRIEF).toMatch(/Add to Home Screen/)
    expect(INSTALL_HINT_LOGIN_BRIEF).toMatch(/Install/)
    expect(INSTALL_HINT_ONLINE).toMatch(/no offline/i)
    expect(INSTALL_HINT_STANDALONE).toMatch(/installed app/)
    expect(hint).toContain('INSTALL_HINT_IPHONE')
    expect(hint).toContain('INSTALL_HINT_CHROME')
    expect(hint).toContain('INSTALL_HINT_LOGIN_BRIEF')
    expect(hint).toContain('INSTALL_HINT_STANDALONE')
  })

  it('lives on Settings and login, sized at --sw-touch', () => {
    expect(settings).toMatch(/InstallHint/)
    expect(login).toMatch(/LoginInstallTip/)
    expect(css).toMatch(/\.install-hint \{[\s\S]{0,400}?min-height: var\(--sw-touch\)/)
    expect(css).toMatch(/display-mode: standalone/)
  })

  it('documents standalone auth smoke and keeps start_url at /home', () => {
    expect(PWA_START_URL).toBe('/home')
    expect(runbook).toMatch(/Add to Home Screen/)
    expect(runbook).toMatch(/installed/)
    expect(runbook).toMatch(/\/home/)
    expect(runbook).toMatch(/Google/)
    expect(runbook).toMatch(/Studio/)
    expect(runbook).toMatch(/no service worker/i)
    expect(existsSync(join(root, 'public/sw.js'))).toBe(false)
  })
})
