import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { scanProjectClaims } from '../governance/claim-scanner'
import { governancePolicyBodySchema } from '../governance/schema'
import { createEmptyProject, parseStudioProject } from '../project/schema'
import { planVariantMatrix } from '../variant/schema'
import { mergeBrandKitForLocale } from './brand-merge'
import { applyMoneyToCta, formatProjectMoney } from './money'
import {
  captureLocaleCopy,
  fontFallbackWarning,
  localeTextDirection,
  missingTranslationChips,
  resolveLocalized,
  switchProjectLocale,
  writeLocaleCopy,
} from './resolve'
import { emptyLocalization, parseLocalization } from './schema'
import { stubTranslator, translateLocaleCopy } from './translate'

const withCaption = (text: string) => {
  const base = createEmptyProject({
    id: '11111111-1111-4111-8111-111111111111',
    productId: 'demo',
  })
  return parseStudioProject({
    ...base,
    overlays: [
      {
        id: 'ov1',
        kind: 'caption',
        text,
        from: 0,
        durationInFrames: 30,
      },
    ],
  })
}

describe('localization (#325–#336)', () => {
  it('defaults localization on empty projects', () => {
    const project = createEmptyProject({
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'demo',
    })
    expect(project.localization.activeLocale).toBe('en')
    expect(project.localization.locales).toContain('en')
  })

  it('resolves Localized<T> with locale fallback', () => {
    expect(resolveLocalized({ default: 'Hello', byLocale: { fr: 'Bonjour' } }, 'fr')).toBe(
      'Bonjour',
    )
    expect(resolveLocalized({ default: 'Hello', byLocale: { fr: 'Bonjour' } }, 'de')).toBe('Hello')
  })

  it('switches locale and restores English copy', () => {
    const start = withCaption('Read PDFs faster')
    const fr = switchProjectLocale(start, 'fr')
    expect(fr.localization.activeLocale).toBe('fr')
    expect(fr.overlays[0]?.text).toBe('Read PDFs faster')
    const edited = parseStudioProject({
      ...fr,
      overlays: [{ ...fr.overlays[0]!, text: 'Lisez les PDF plus vite' }],
      revision: fr.revision,
    })
    const back = switchProjectLocale(edited, 'en')
    expect(back.overlays[0]?.text).toBe('Read PDFs faster')
    expect(back.localization.copy.fr?.overlays.ov1).toBe('Lisez les PDF plus vite')
  })

  it('emits missing-translation chips when the active locale lacks copy', () => {
    const start = withCaption('Read PDFs faster')
    const fr = switchProjectLocale(start, 'fr')
    const wiped = parseStudioProject({
      ...fr,
      localization: {
        ...fr.localization,
        copy: {
          ...fr.localization.copy,
          fr: { overlays: {}, slides: {} },
        },
      },
    })
    const chips = missingTranslationChips(wiped)
    expect(chips.some((chip) => chip.key === 'overlay.ov1')).toBe(true)
  })

  it('marks ar/he as rtl and warns when the font is not Noto', () => {
    expect(localeTextDirection('ar')).toBe('rtl')
    expect(localeTextDirection('en-GB')).toBe('ltr')
    expect(fontFallbackWarning({ locale: 'ar', fontFamily: 'Georgia' })).toMatch(/Noto/)
    expect(fontFallbackWarning({ locale: 'ar', fontFamily: 'Noto Sans Arabic' })).toBeNull()
    expect(fontFallbackWarning({ locale: 'sv', fontFamily: 'Georgia' })).toBeNull()
  })

  it('formats money and appends a trailing price without eating mid-copy figures', () => {
    const formatted = formatProjectMoney({ currency: 'GBP', amountMinor: 1299 }, 'en-GB')
    expect(formatted).toMatch(/12\.99|£12/)
    expect(applyMoneyToCta('Start free', formatted)).toMatch(/Start free/)
    expect(applyMoneyToCta('Our £1M ARR story', formatted)).toMatch(/£1M/)
    expect(applyMoneyToCta('Our £1M ARR story', formatted)).toContain(formatted ?? '')
    const once = applyMoneyToCta('Start free', formatted)
    const twice = applyMoneyToCta(
      once,
      formatProjectMoney({ currency: 'GBP', amountMinor: 1400 }, 'en-GB'),
    )
    expect(twice).not.toMatch(/12\.99/)
    expect(twice).toMatch(/Start free/)
    expect(applyMoneyToCta('Start free · GBP 12.99', 'GBP 14.00')).toBe('Start free · GBP 14.00')
  })

  it('stores translated copy without switching preview when applyToPreview is false', () => {
    const start = withCaption('Read PDFs faster')
    const filled = writeLocaleCopy(start, {
      locale: 'fr',
      source: captureLocaleCopy(start),
      translated: { overlays: { ov1: '[fr] Read PDFs faster' }, slides: {} },
      applyToPreview: false,
    })
    expect(filled.localization.activeLocale).toBe('en')
    expect(filled.overlays[0]?.text).toBe('Read PDFs faster')
    expect(filled.localization.copy.fr?.overlays.ov1).toBe('[fr] Read PDFs faster')
  })

  it('stub-translates only missing keys', async () => {
    const next = await translateLocaleCopy({
      source: {
        overlays: { ov1: 'Hello', ov2: 'World' },
        slides: {},
        intent: { cta: 'Try the private example' },
      },
      target: { overlays: { ov1: '[fr] Hello' }, slides: {}, intent: {} },
      from: 'en',
      to: 'fr',
      translate: stubTranslator,
    })
    expect(next.overlays.ov1).toBe('[fr] Hello')
    expect(next.overlays.ov2).toBe('[fr] World')
    expect(next.intent?.cta).toBe('[fr] Try the private example')
  })

  it('leaves brand files unchanged when no locale overlay exists', async () => {
    const merged = await mergeBrandKitForLocale({
      kitRoot: path.join(os.tmpdir(), 'missing-brand-kit'),
      locale: 'fr',
      files: { 'colors.json': { primary: '#111' } },
    })
    expect(merged['colors.json']?.primary).toBe('#111')
  })

  it('deep-merges a locale overlay when the file exists', async () => {
    const kitRoot = await mkdtemp(path.join(os.tmpdir(), 'mos-kit-'))
    await mkdir(path.join(kitRoot, 'locales', 'fr'), { recursive: true })
    await writeFile(
      path.join(kitRoot, 'locales', 'fr', 'colors.json'),
      JSON.stringify({ primary: '#00ff00' }),
    )
    try {
      const merged = await mergeBrandKitForLocale({
        kitRoot,
        locale: 'fr',
        files: { 'colors.json': { primary: '#111', ink: '#fff' } },
      })
      expect(merged['colors.json']).toEqual({ primary: '#00ff00', ink: '#fff' })
    } finally {
      await rm(kitRoot, { recursive: true, force: true })
    }
  })

  it('throws when a locale overlay file is invalid JSON', async () => {
    const kitRoot = await mkdtemp(path.join(os.tmpdir(), 'mos-kit-bad-'))
    await mkdir(path.join(kitRoot, 'locales', 'fr'), { recursive: true })
    await writeFile(path.join(kitRoot, 'locales', 'fr', 'colors.json'), '{not json')
    try {
      await expect(
        mergeBrandKitForLocale({
          kitRoot,
          locale: 'fr',
          files: { 'colors.json': { primary: '#111' } },
        }),
      ).rejects.toThrow(/Invalid JSON/)
    } finally {
      await rm(kitRoot, { recursive: true, force: true })
    }
  })

  it('skips locale-scoped claim rules on other languages', () => {
    const policy = governancePolicyBodySchema.parse({
      slug: 'default',
      version: 1,
      stages: [{ key: 'owner', label: 'Owner', minRole: 'owner' }],
      claimRules: [
        {
          id: 'fr-only',
          pattern: 'gratuit',
          severity: 'block',
          locales: ['fr'],
          suggestion: 'French-only claim',
        },
      ],
    })
    const base = withCaption('C’est gratuit')
    const english = scanProjectClaims(base, policy)
    expect(english.ok).toBe(true)
    const french = scanProjectClaims(switchProjectLocale(base, 'fr'), policy)
    expect(french.ok).toBe(false)
    expect(french.hits.some((hit) => hit.ruleId === 'fr-only')).toBe(true)
  })

  it('multiplies the variant matrix by optional locales', () => {
    const plan = planVariantMatrix({
      platforms: ['tiktok'],
      hookIndexes: [0],
      ctaIndexes: [0, 1],
      locales: ['en', 'fr'],
    })
    expect(plan.items).toHaveLength(4)
    expect(plan.items.filter((item) => item.locale === 'fr')).toHaveLength(2)
    expect(plan.items.some((item) => item.label.includes('fr'))).toBe(true)
    expect(() =>
      planVariantMatrix({
        platforms: ['tiktok'],
        hookIndexes: [0],
        ctaIndexes: [0],
        locales: ['not a locale'],
      }),
    ).toThrow()
  })

  it('exports emptyLocalization with en default', () => {
    expect(emptyLocalization().defaultLocale).toBe('en')
    expect(
      parseLocalization({ defaultLocale: 'zh-Hant', activeLocale: 'zh-Hant', locales: ['zh-Hant'] })
        .activeLocale,
    ).toBe('zh-Hant')
  })
})
