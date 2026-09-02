import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createEmptyProject, parseStudioProject } from '../project/schema'
import { scanProjectClaims } from './claim-scanner'
import { withGovernanceDisclaimer } from './disclaimer'
import { governancePolicyBodySchema, roleMeetsMinimum } from './schema'

const here = path.dirname(fileURLToPath(import.meta.url))
const demoPolicyPath = path.resolve(
  here,
  '../../../../products/demo/governance/approval-policy.json',
)

describe('governance schema + claim scanner (#311–#313)', () => {
  it('parses demo approval-policy.json', () => {
    const raw = JSON.parse(readFileSync(demoPolicyPath, 'utf8'))
    const body = governancePolicyBodySchema.parse(raw)
    expect(body.stages).toHaveLength(2)
    expect(body.disclaimer.required).toBe(true)
    expect(body.disclaimer.text).toMatch(/Demo/)
    expect(body.disclaimer.text).not.toMatch(/the private example|Hepteract/i)
  })

  it('roleMeetsMinimum respects owner > editor > viewer', () => {
    expect(roleMeetsMinimum('owner', 'editor')).toBe(true)
    expect(roleMeetsMinimum('editor', 'owner')).toBe(false)
    expect(roleMeetsMinimum('viewer', 'editor')).toBe(false)
  })

  it('blocks HIPAA-style claims on overlays using the demo policy', () => {
    const base = createEmptyProject({
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'demo',
    })
    const project = parseStudioProject({
      ...base,
      overlays: [
        {
          id: 'ov1',
          kind: 'caption',
          text: 'We are HIPAA compliant forever',
          from: 0,
          durationInFrames: 30,
        },
      ],
    })
    const policy = governancePolicyBodySchema.parse(
      JSON.parse(readFileSync(demoPolicyPath, 'utf8')),
    )
    const scan = scanProjectClaims(project, policy)
    expect(scan.ok).toBe(false)
    expect(scan.hits.some((hit) => hit.severity === 'block')).toBe(true)
  })

  it('still scans overlays[].text when Catalog proofStats are bound (#1199)', () => {
    const base = createEmptyProject({
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'demo',
    })
    const project = parseStudioProject({
      ...base,
      brand: {
        productId: 'demo',
        displayName: 'the private example',
        proofStats: [{ value: 40, unit: 'hours', source: 'catalog' }],
      },
      overlays: [
        {
          id: 'ov1',
          kind: 'caption',
          text: 'We are HIPAA compliant forever',
          from: 0,
          durationInFrames: 30,
        },
      ],
    })
    const policy = governancePolicyBodySchema.parse(
      JSON.parse(readFileSync(demoPolicyPath, 'utf8')),
    )
    const scan = scanProjectClaims(project, policy)
    expect(scan.ok).toBe(false)
    expect(scan.hits.some((hit) => hit.source === 'overlay.caption')).toBe(true)
    expect(scan.hits.some((hit) => hit.severity === 'block')).toBe(true)
  })

  it('blocks HIPAA-style claims on authored BrandText (#1197)', () => {
    const base = createEmptyProject({
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'demo',
      compositionId: 'authored',
    })
    const project = parseStudioProject({
      ...base,
      compositionSource: {
        source: `import { AbsoluteFill } from 'remotion'
import { BrandText } from '@synawood/creative/motion-kit'
export default () => <AbsoluteFill><BrandText text="We are HIPAA compliant" /></AbsoluteFill>
`,
        motionSeed: 'seed-claim-1',
        compileError: null,
      },
    })
    const policy = governancePolicyBodySchema.parse(
      JSON.parse(readFileSync(demoPolicyPath, 'utf8')),
    )
    const scan = scanProjectClaims(project, policy)
    expect(scan.ok).toBe(false)
    expect(scan.hits.some((hit) => hit.source === 'compositionSource.kit')).toBe(true)
  })

  it('applies the demo disclaimer onto a project when required', () => {
    const project = createEmptyProject({
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'demo',
    })
    const policy = governancePolicyBodySchema.parse(
      JSON.parse(readFileSync(demoPolicyPath, 'utf8')),
    )
    const next = withGovernanceDisclaimer(project, policy)
    expect(next.governanceDisclaimer).toMatch(/Demo/)
    expect(next.governanceDisclaimer).not.toMatch(/the private example/i)
  })
})
