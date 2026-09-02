import { describe, expect, it } from 'vitest'
import { LEGAL_AUTHORED_FIXTURE, LEGAL_KIT_FIXTURE } from '../authored/fixtures'
import { demoLikeCatalogFixture, proofNumbersFromCatalog } from '../brand/demo-catalog-fixture'
import { createEmptyProject } from '../project/schema'
import {
  inspectAuthoredComposition,
  motionFingerprint,
  emptyStructureInspectWarning,
} from './inspect-authored'

const FADE_POSTER = `import { AbsoluteFill, useCurrentFrame } from 'remotion'

export default function FadePoster() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: 0.4, justifyContent: 'center', textAlign: 'center' }}>
      <div>Still juggling PDFs? {frame}</div>
    </AbsoluteFill>
  )
}
`

const KEN_BURNS_STILL = `import { AbsoluteFill, useCurrentFrame } from 'remotion'

export default function KenBurnsStill() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <div>ken burns still of the logo {frame}</div>
    </AbsoluteFill>
  )
}
`

const HIPAA_BRAND_TEXT = LEGAL_KIT_FIXTURE.replace(
  "import { KineticType } from '@synawood/creative/motion-kit'",
  "import { BrandText, KineticType } from '@synawood/creative/motion-kit'",
).replace(
  '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
  '<KineticType text={\'Frame \' + frame} />\n      <BrandText text="HIPAA compliant" />',
)

const authored = (
  source: string,
  extra?: {
    layout?: 'full-bleed-type' | 'split-stat'
    brand?: boolean
  },
) => {
  const base = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
    compositionId: 'authored',
  })
  return {
    ...base,
    brand:
      extra?.brand === false
        ? { productId: 'demo', displayName: 'the private example' }
        : {
            productId: 'demo',
            displayName: 'the private example',
            logoAssetId: '33333333-3333-4333-8333-333333333333',
            defaultCta: 'Try the private example',
          },
    intent: {
      ...base.intent,
      keywords: ['40'],
      audience: { persona: 'UK bid writers' },
      primaryMessage: 'Get 40 hours back on tender prep',
    },
    compositionSource: {
      source,
      motionSeed: 'seed-inspect-1',
      compileError: null,
      artDirection: {
        dialect: 'editorial' as const,
        layout: extra?.layout ?? 'full-bleed-type',
      },
    },
  }
}

describe('inspectAuthoredComposition (#1197)', () => {
  it('fails static centered type with a fade', () => {
    const result = inspectAuthoredComposition(authored(FADE_POSTER))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('motion')
    expect(result.error).toMatch(/static poster/)
  })

  it('fails Ken Burns still when the brief needed kinetic type', () => {
    const result = inspectAuthoredComposition(authored(KEN_BURNS_STILL))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('motion')
  })

  it('fails CountUp numbers not in Catalog/DNA', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      "import { KineticType } from '@synawood/creative/motion-kit'",
      "import { CountUp, KineticType } from '@synawood/creative/motion-kit'",
    ).replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      '<CountUp value={99999} label="hours" />',
    )
    const result = inspectAuthoredComposition(authored(source))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('claims')
    expect(result.error).toMatch(/99999/)
  })

  it('fails BrandText that invents a forbidden claim', () => {
    const result = inspectAuthoredComposition(authored(HIPAA_BRAND_TEXT))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('claims')
    expect(result.error).toMatch(/HIPAA/i)
  })

  it('fails split-stat without CountUp', () => {
    const result = inspectAuthoredComposition(authored(LEGAL_KIT_FIXTURE, { layout: 'split-stat' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('hierarchy')
  })

  it('treats CountUp to={} as the split-stat proof (#1269)', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      "import { KineticType } from '@synawood/creative/motion-kit'",
      "import { CountUp, KineticType } from '@synawood/creative/motion-kit'",
    ).replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      `<CountUp
            to={40}
            from={0}
            durationInFrames={60}
          />`,
    )
    const result = inspectAuthoredComposition(authored(source, { layout: 'split-stat' }))
    expect(result.ok).toBe(true)
  })

  it('passes kit dialect fixture with a catalog number', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      "<KineticType text={'40 hours back'} />",
    )
    const result = inspectAuthoredComposition(authored(source))
    expect(result.ok).toBe(true)
  })

  it('does not fail inspect on empty beats; warning is not a pill (#1201)', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      "<KineticType text={'40 hours back'} />",
    )
    const project = authored(source)
    const empty = {
      ...project,
      compositionSource: {
        ...project.compositionSource!,
        artDirection: {
          ...project.compositionSource!.artDirection!,
          beatLayout: {
            emptyStructure: true,
            hookLayout: 'full-bleed-type' as const,
            sequences: [
              {
                kind: 'fallback' as const,
                from: 0,
                durationInFrames: 1800,
                kit: 'KineticType' as const,
                note: 'empty',
              },
            ],
          },
        },
      },
    }
    expect(inspectAuthoredComposition(empty).ok).toBe(true)
    expect(emptyStructureInspectWarning(empty)).toMatch(/Approve still works/)
    expect(emptyStructureInspectWarning(project)).toBeNull()
  })

  it('passes CountUp from a the private example-like catalog proofStat (#1199)', () => {
    const catalog = demoLikeCatalogFixture()
    const value = proofNumbersFromCatalog(catalog)[0]
    expect(value).toBe(40)
    const source = LEGAL_KIT_FIXTURE.replace(
      "import { KineticType } from '@synawood/creative/motion-kit'",
      "import { CountUp, KineticType } from '@synawood/creative/motion-kit'",
    ).replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      `<CountUp value={${value}} label="hours" />`,
    )
    const base = authored(source)
    const project = {
      ...base,
      brand: {
        ...base.brand,
        proofStats: [
          { value, unit: 'hours', source: 'catalog' as const, claimId: catalog.items[0]?.id },
        ],
      },
    }
    expect(inspectAuthoredComposition(project).ok).toBe(true)
  })

  it('passes LEGAL_AUTHORED_FIXTURE spring motion', () => {
    expect(inspectAuthoredComposition(authored(LEGAL_AUTHORED_FIXTURE)).ok).toBe(true)
  })

  it('fails when Sequences end before the canvas tail (#1265)', () => {
    const source = `import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion'
export default function Ad() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 8], [0.3, 1])
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={450}>
        <div style={{ opacity }}>Hook</div>
      </Sequence>
    </AbsoluteFill>
  )
}
`
    const result = inspectAuthoredComposition({ ...authored(source), durationFrames: 497 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('picture')
    expect(result.error).toMatch(/no Sequence/)
  })

  it('fails when brand chrome is missing', () => {
    const result = inspectAuthoredComposition(authored(LEGAL_AUTHORED_FIXTURE, { brand: false }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brand')
  })

  it('fails a repeated fingerprint unless sequel', () => {
    const project = authored(LEGAL_AUTHORED_FIXTURE)
    const fingerprint = motionFingerprint(project)
    const repeat = inspectAuthoredComposition(project, { recentFingerprints: [fingerprint] })
    expect(repeat.ok).toBe(false)
    if (!repeat.ok) expect(repeat.check).toBe('variety')
    const sequel = inspectAuthoredComposition(project, {
      recentFingerprints: [fingerprint],
      sequel: true,
    })
    expect(sequel.ok).toBe(true)
  })

  it('fingerprints the whole collapsed source, not a 240-char prefix', () => {
    const a = authored(`${LEGAL_AUTHORED_FIXTURE}\n/* unique-a */`)
    const b = authored(`${LEGAL_AUTHORED_FIXTURE}\n/* unique-b */`)
    expect(motionFingerprint(a)).not.toBe(motionFingerprint(b))
  })

  it('fails DeviceFrame/Img when stills exist but host props are unbound (#1329)', () => {
    const source = `import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion'
import { DeviceFrame, KineticType } from '@synawood/creative/motion-kit'

export default function Unbound() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ opacity }}>
      <Sequence from={0} durationInFrames={90}>
        <DeviceFrame>
          <AbsoluteFill />
        </DeviceFrame>
        <KineticType dialect="snappy" text="Hook" />
      </Sequence>
    </AbsoluteFill>
  )
}
`
    const base = authored(source)
    const project = {
      ...base,
      durationFrames: 90,
      assets: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          kind: 'image' as const,
          blobKey: 'local/still.png',
          source: 'generator' as const,
          probe: {},
        },
      ],
    }
    const result = inspectAuthoredComposition(project)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('picture')
    expect(result.error).toMatch(/props\.productUrl|props\.plates/i)
  })
})

describe('inspectAuthoredComposition constitution (#1243)', () => {
  it('fails everyone-audience on brief', () => {
    const project = {
      ...authored(LEGAL_AUTHORED_FIXTURE),
      intent: {
        ...authored(LEGAL_AUTHORED_FIXTURE).intent,
        audience: { persona: 'everyone' },
      },
    }
    const result = inspectAuthoredComposition(project)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/audience|everyone/i)
  })

  it('fails empty or missing audience persona on brief', () => {
    const base = authored(LEGAL_AUTHORED_FIXTURE)
    expect(
      inspectAuthoredComposition({ ...base, intent: { ...base.intent, audience: {} } }).ok,
    ).toBe(false)
    expect(
      inspectAuthoredComposition({
        ...base,
        intent: { ...base.intent, audience: { persona: '' } },
      }).ok,
    ).toBe(false)
    expect(
      inspectAuthoredComposition({ ...base, intent: { ...base.intent, audience: undefined } }).ok,
    ).toBe(false)
  })

  it('fails three unrelated headlines when Intent has one primaryMessage', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      "import { KineticType } from '@synawood/creative/motion-kit'",
      "import { BrandText, KineticType } from '@synawood/creative/motion-kit'",
    ).replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      `<KineticType text={'40 hours back'} />
      <BrandText text="Cloud storage" />
      <BrandText text="Team sync hub" />
      <BrandText text="Mobile access" />`,
    )
    const result = inspectAuthoredComposition(authored(source))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/headline|message/i)
  })

  it('fails hook, body, and end card arguing three unrelated benefits (#1224)', () => {
    const source = `import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BrandText, KineticType } from '@synawood/creative/motion-kit'

export default function Dump() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const y = spring({ frame, fps, config: { damping: 14 } })
  return (
    <AbsoluteFill style={{ transform: 'translateY(' + y + 'px)' }}>
      <Sequence from={0} durationInFrames={600}>
        <KineticType text={'Cloud storage'} />
      </Sequence>
      <Sequence from={600} durationInFrames={600}>
        <BrandText text="Team sync hub" />
      </Sequence>
      <Sequence from={1200} durationInFrames={600}>
        <BrandText text="Mobile access" />
      </Sequence>
    </AbsoluteFill>
  )
}
`
    const result = inspectAuthoredComposition({ ...authored(source), durationFrames: 1800 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/headline|message/i)
  })

  it('passes one primaryMessage plus two supporting points on screen (#1224)', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      "import { KineticType } from '@synawood/creative/motion-kit'",
      "import { BrandText, KineticType } from '@synawood/creative/motion-kit'",
    ).replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      `<KineticType text={'40 hours back'} />
      <BrandText text="One inbox" />
      <BrandText text="Start a trial" />`,
    )
    const base = authored(source)
    const result = inspectAuthoredComposition({
      ...base,
      intent: {
        ...base.intent,
        primaryMessage: 'Get 40 hours back on tender prep',
        supportingPoints: ['One inbox', 'Start a trial'],
      },
    })
    expect(result.ok).toBe(true)
  })

  it('passes brief on kit fixture with catalog number and specific audience', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      "<KineticType text={'40 hours back'} />",
    )
    const result = inspectAuthoredComposition(authored(source))
    expect(result.ok).toBe(true)
  })

  it('fails logo-intro open with only LottieStinger and BrandText', () => {
    const source = `import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BrandText, LottieStinger } from '@synawood/creative/motion-kit'

export default function LogoOpen() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const y = spring({ frame, fps, config: { damping: 14 } })
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={12}>
        <LottieStinger id="logo" />
        <BrandText text="the private example" />
      </Sequence>
      <Sequence from={12} durationInFrames={400}>
        <div style={{ transform: 'translateY(' + y + 'px)' }}>Later beat</div>
      </Sequence>
    </AbsoluteFill>
  )
}
`
    const result = inspectAuthoredComposition({ ...authored(source), durationFrames: 412 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/logo|open|problem|message/i)
  })

  it('fails muted-death without captions or on-screen copy', () => {
    const source = `import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export default function SilentMotion() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const y = spring({ frame, fps, config: { damping: 14 } })
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d0c' }}>
      <div style={{ width: 100, height: 100, background: '#333', transform: 'translateY(' + y + 'px)' }} />
    </AbsoluteFill>
  )
}
`
    const result = inspectAuthoredComposition(authored(source))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/mute|caption|KineticType/i)
  })

  it('passes LEGAL_AUTHORED_FIXTURE jsx hook for mute-robust brief', () => {
    expect(inspectAuthoredComposition(authored(LEGAL_AUTHORED_FIXTURE)).ok).toBe(true)
  })

  it('fails feature-dump on-screen copy on brief', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      '<KineticType text="Fast! Easy! AI-powered!" />',
    )
    const result = inspectAuthoredComposition(authored(source))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/feature|promise|headline/i)
  })
})

describe('inspectAuthoredComposition CTA brief (#1220)', () => {
  const closeSource = (
    ctaText: string,
  ) => `import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BrandText, KineticType } from '@synawood/creative/motion-kit'

export default function CloseCta() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const y = spring({ frame, fps, config: { damping: 14 } })
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={360}>
        <KineticType text={'40 hours back'} />
      </Sequence>
      <Sequence from={360} durationInFrames={120}>
        <BrandText text="${ctaText}" />
      </Sequence>
    </AbsoluteFill>
  )
}
`

  it('fails tof + Buy now on BrandText close', () => {
    const project = {
      ...authored(closeSource('Buy now')),
      durationFrames: 480,
      intent: {
        ...authored(closeSource('Buy now')).intent,
        funnelStage: 'tof' as const,
        goal: 'awareness' as const,
        cta: 'Learn more',
      },
    }
    const result = inspectAuthoredComposition(project)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/top-of-funnel|hard-sell|Buy now/i)
  })

  it('fails bof authored with no end CTA', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      "<KineticType text={'40 hours back'} />",
    )
    const project = {
      ...authored(source),
      intent: {
        ...authored(source).intent,
        funnelStage: 'bof' as const,
        goal: 'signup' as const,
        cta: 'Start a trial',
      },
    }
    const result = inspectAuthoredComposition(project)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.check).toBe('brief')
    expect(result.error).toMatch(/last-seconds CTA|Intent\.cta/i)
  })

  it('passes when close BrandText matches intent.cta', () => {
    const project = {
      ...authored(closeSource('Start a trial')),
      durationFrames: 480,
      intent: {
        ...authored(closeSource('Start a trial')).intent,
        funnelStage: 'bof' as const,
        goal: 'signup' as const,
        cta: 'Start a trial',
      },
    }
    expect(inspectAuthoredComposition(project).ok).toBe(true)
  })

  it('passes LEGAL_KIT fixture without conversion intent (#1243)', () => {
    const source = LEGAL_KIT_FIXTURE.replace(
      '<KineticType dialect="editorial" text={\'Frame \' + frame} />',
      "<KineticType text={'40 hours back'} />",
    )
    expect(inspectAuthoredComposition(authored(source)).ok).toBe(true)
  })
})
