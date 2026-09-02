import { describe, expect, it } from 'vitest'
import { parseBrollAssembleBody, parseBrollCommitBody, parseBrollRejectBody } from './http'

describe('broll HTTP parse (#523)', () => {
  it('parses assemble with optional scene ids and dryRun default omitted', () => {
    expect(
      parseBrollAssembleBody({
        expectedRevision: 3,
        sceneIds: ['sc_proof'],
      }),
    ).toEqual({
      expectedRevision: 3,
      sceneIds: ['sc_proof'],
    })
  })

  it('rejects assemble without a revision', () => {
    expect(() => parseBrollAssembleBody({ sceneIds: ['sc_proof'] })).toThrow()
  })

  it('parses commit with confirmSpend', () => {
    expect(
      parseBrollCommitBody({
        expectedRevision: 4,
        planId: '11111111-1111-4111-8111-111111111111',
        confirmSpend: true,
      }),
    ).toEqual({
      expectedRevision: 4,
      planId: '11111111-1111-4111-8111-111111111111',
      confirmSpend: true,
    })
  })

  it('parses reject with planId', () => {
    expect(
      parseBrollRejectBody({
        expectedRevision: 4,
        planId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual({
      expectedRevision: 4,
      planId: '11111111-1111-4111-8111-111111111111',
    })
  })
})
