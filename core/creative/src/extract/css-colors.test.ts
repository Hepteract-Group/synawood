import { describe, expect, it } from 'vitest'
import {
  isBrandWorthyColor,
  listStylesheetHrefs,
  parseCssColorHits,
  rankCssColors,
} from './css-colors'
import { parseHtmlDigest } from './url-adapter'

describe('isBrandWorthyColor', () => {
  it('rejects slate UI chrome and accepts vivid brand hues', () => {
    expect(isBrandWorthyColor('#101828')).toBe(false)
    expect(isBrandWorthyColor('#364153')).toBe(false)
    expect(isBrandWorthyColor('#1a5c3a')).toBe(true)
    expect(isBrandWorthyColor('#e85a9b')).toBe(true)
  })
})

describe('parseCssColorHits + rankCssColors', () => {
  it('prefers brand tokens and button selectors over incidental hex', () => {
    const css = `
      :root {
        --brand-primary: #1a5c3a;
        --brand-accent: #c45c26;
        --gray-100: #f5f5f5;
      }
      .noise { color: #abcdef; }
      button.primary, .btn {
        background-color: #1a5c3a;
        color: #ffffff;
      }
      a { color: #336699; }
    `
    const ranked = rankCssColors(parseCssColorHits(css), 4)
    expect(ranked[0]).toBe('#1a5c3a')
    expect(ranked).toContain('#c45c26')
    expect(ranked[0]).not.toBe('#abcdef')
  })

  it('produces different palettes for two fixture stylesheets', () => {
    const demo = rankCssColors(
      parseCssColorHits(`
        :root { --brand-primary: #1a5c3a; --brand-accent: #c45c26; }
        header { background: #1a5c3a; }
      `),
    )
    const acme = rankCssColors(
      parseCssColorHits(`
        :root { --primary: #2244aa; --accent: #ee8800; }
        .hero-cta { background-color: #2244aa; }
      `),
    )
    expect(demo[0]).toBe('#1a5c3a')
    expect(acme[0]).toBe('#2244aa')
    expect(demo[0]).not.toBe(acme[0])
  })
})

describe('listStylesheetHrefs', () => {
  it('absolutizes stylesheet links and caps count', () => {
    const html = `
      <link rel="stylesheet" href="/a.css" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="stylesheet" href="https://cdn.example.com/b.css" />
      <link rel="stylesheet" href="/c.css" />
      <link rel="stylesheet" href="/d.css" />
      <link rel="stylesheet" href="/e.css" />
    `
    const hrefs = listStylesheetHrefs(html, new URL('https://example.com/page'), 4)
    expect(hrefs).toEqual([
      'https://example.com/a.css',
      'https://cdn.example.com/b.css',
      'https://example.com/c.css',
      'https://example.com/d.css',
    ])
  })
})

describe('parseHtmlDigest colors', () => {
  it('uses inline CSS ranking and ignores raw HTML hex noise', () => {
    const html = `
      <html>
        <head>
          <title>Acme</title>
          <meta name="theme-color" content="#112233" />
          <style>
            :root { --brand-primary: #aa2200; }
            .btn { background: #aa2200; }
          </style>
        </head>
        <body>
          <!-- noise hex that used to win the raw scan: #999999 -->
          <svg><path fill="#999999"/></svg>
          <p>Acme builds widgets for modern teams.</p>
        </body>
      </html>
    `
    const digest = parseHtmlDigest(html, new URL('https://acme.example/'))
    expect(digest.themeColor).toBe('#112233')
    expect(digest.colorGuesses[0]).toBe('#112233')
    expect(digest.colorGuesses).toContain('#aa2200')
    expect(digest.colorGuesses).not.toContain('#999999')
  })
})
