import { describe, expect, it } from 'vitest'
import { approvalAuditToCsv, csvEscapeField, type ApprovalAuditRow } from './audit'
import { assertClaimScanClear, scanProjectClaims } from './claim-scanner'
import {
  assertOwnerCanOverride,
  assertReadyForFinal,
  assertRejectReason,
  MIN_OVERRIDE_REASON_CHARS,
} from './gates'
import { createEmptyProject, parseStudioProject } from '../project/schema'
import { governancePolicyBodySchema } from './schema'

const demoPolicy = governancePolicyBodySchema.parse({
  slug: 'default',
  version: 1,
  stages: [{ key: 'owner', label: 'Owner', minRole: 'owner' }],
  claimRules: [
    {
      id: 'hipaa',
      pattern: '\\bhipaa[\\s-]?compliant\\b',
      severity: 'block',
      suggestion: 'Drop it.',
    },
    {
      id: 'tone',
      pattern: 'unicorn-grade',
      severity: 'warn',
      suggestion: 'Soften.',
    },
  ],
  disclaimer: { required: true, text: 'Not legal advice.' },
})

describe('governance closeout (#321–#323)', () => {
  it('escapes CSV fields that contain commas and quotes', () => {
    expect(csvEscapeField('plain')).toBe('plain')
    expect(csvEscapeField('a,b')).toBe('"a,b"')
    expect(csvEscapeField('say "hi"')).toBe('"say ""hi"""')
  })

  it('serializes audit rows with a stable header', () => {
    const rows: ApprovalAuditRow[] = [
      {
        run: {
          id: '11111111-1111-4111-8111-111111111111',
          productId: 'demo',
          projectId: '22222222-2222-4222-8222-222222222222',
          status: 'overridden',
          policyVersion: 1,
        },
        event: {
          id: '33333333-3333-4333-8333-333333333333',
          runId: '11111111-1111-4111-8111-111111111111',
          stageKey: 'owner',
          stageIndex: 0,
          action: 'override',
          actorUserId: null,
          actorRole: 'owner',
          reason: 'Ship now, legal reviewed',
          detail: {},
          createdAt: '2026-08-17T00:00:00.000Z',
        },
      },
    ]
    const csv = approvalAuditToCsv(rows)
    expect(csv.startsWith('run_id,project_id,run_status,')).toBe(true)
    expect(csv).toContain('overridden')
    expect(csv).toContain('override')
    expect(csv).toContain('Ship now, legal reviewed')
    expect(csv).toContain('detail')
  })

  it('serializes claim-scan detail JSON on the detail column', () => {
    const rows: ApprovalAuditRow[] = [
      {
        run: {
          id: '11111111-1111-4111-8111-111111111111',
          productId: 'demo',
          projectId: '22222222-2222-4222-8222-222222222222',
          status: 'open',
          policyVersion: 1,
        },
        event: {
          id: '33333333-3333-4333-8333-333333333333',
          runId: '11111111-1111-4111-8111-111111111111',
          stageKey: 'owner',
          stageIndex: 0,
          action: 'claim_scan',
          actorUserId: null,
          actorRole: 'owner',
          reason: 'scan',
          detail: { claimScan: { ok: true, hits: [] } },
          createdAt: '2026-08-17T00:00:00.000Z',
        },
      },
    ]
    const csv = approvalAuditToCsv(rows)
    expect(csv).toContain('claimScan')
    expect(csv).toContain('""ok"":true')
  })

  it('warn-only hits do not fail the claim scan', () => {
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
          text: 'Our unicorn-grade export for busy founders',
          from: 0,
          durationInFrames: 30,
        },
      ],
    })
    const scan = scanProjectClaims(project, demoPolicy)
    expect(scan.ok).toBe(true)
    expect(scan.hits.some((hit) => hit.severity === 'warn')).toBe(true)
    expect(() => assertClaimScanClear(scan)).not.toThrow()
  })

  it('assertReadyForFinal refuses blocked claims even for Override', () => {
    const scan = {
      ok: false,
      hits: [
        {
          ruleId: 'hipaa',
          severity: 'block' as const,
          match: 'HIPAA compliant',
          suggestion: 'Drop it.',
          source: 'overlay.caption',
        },
      ],
      scannedAt: '2026-08-17T00:00:00.000Z',
    }
    expect(() =>
      assertReadyForFinal({
        scan,
        disclaimerRequired: false,
        disclaimerText: null,
        verb: 'Override',
      }),
    ).toThrow(/claim scanner/)
  })

  it('owner override requires role + a real reason; scanner still applies', () => {
    expect(() => assertOwnerCanOverride('editor', 'this is plenty of chars')).toThrow(/owners/)
    expect(() => assertOwnerCanOverride('owner', 'short')).toThrow(
      new RegExp(String(MIN_OVERRIDE_REASON_CHARS)),
    )
    expect(assertOwnerCanOverride('owner', '  Legal signed off after review  ')).toBe(
      'Legal signed off after review',
    )
  })

  it('reject requires a short reason', () => {
    expect(() => assertRejectReason('  ')).toThrow(/short reason/)
    expect(() => assertRejectReason('no')).toThrow(/short reason/)
    expect(assertRejectReason('  too thin  ')).toBe('too thin')
  })
})
