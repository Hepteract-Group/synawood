import { describe, expect, it, vi } from 'vitest'
import { LEGAL_KIT_FIXTURE } from '../authored/fixtures'
import { MOTION_DIALECTS, MOTION_LAYOUTS } from '../motion-kit/catalog'
import { createEmptyProject } from '../project/schema'
import { LOCKED_FIRST_PARTY_TOOL_NAMES } from './first-party-catalog'
import { STUDIO_TOOL_NAMES, createStudioTools } from './studio-tools'
import type { StudioToolContext } from './types'

const toolCall = { toolCallId: '1', messages: [] } as never

const makeCtx = (): StudioToolContext => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  return {
    productId: 'demo',
    projectId: project.id,
    project,
    expectedRevision: project.revision,
    supabase: { from: vi.fn() } as never,
    blobEnv: {
      connectionString: 'x',
      containerName: 'marketing-os',
      useLocalPrefix: true,
      accountName: 'a',
      accountKey: 'k',
    },
    modelProfileId: 'ci-stub',
    persist: false,
    toolTrace: [],
  }
}

describe('composition tools (#1195)', () => {
  it('registers locked list/write/patch/seed tools', () => {
    for (const name of [
      'list_motion_kit',
      'write_composition',
      'patch_composition',
      'set_motion_seed',
    ] as const) {
      expect(STUDIO_TOOL_NAMES).toContain(name)
      expect(LOCKED_FIRST_PARTY_TOOL_NAMES).toContain(name)
    }
  })

  it('list_motion_kit returns six dialects and five layouts', async () => {
    const tools = createStudioTools(makeCtx())
    const outcome = await tools.list_motion_kit.execute!({}, toolCall)
    expect(outcome).toMatchObject({ ok: true })
    if (!outcome || typeof outcome !== 'object' || !('ok' in outcome) || !outcome.ok) return
    expect(outcome.data?.dialects).toEqual([...MOTION_DIALECTS])
    expect(outcome.data?.layouts).toEqual([...MOTION_LAYOUTS])
    expect(String(outcome.summary)).toMatch(/KineticType/)
    expect(String(outcome.summary)).toMatch(/LottieStinger/)
    expect(String(outcome.summary)).toMatch(/snappy/)
    expect(String(outcome.summary)).toMatch(/@synawood\/creative\/motion-kit/)
    expect(String(outcome.summary)).toMatch(/@remotion\/motion-kit/)
    expect(outcome.data?.kitImport).toMatch(/from '@synawood\/creative\/motion-kit'/)
  })

  it('write_composition compiles a kit example onto the project', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = await tools.write_composition.execute!(
      { source: LEGAL_KIT_FIXTURE, motionSeed: 'seed-tool-1' },
      toolCall,
    )
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.compositionId).toBe('authored')
    expect(ctx.project.compositionSource?.source).toBe(LEGAL_KIT_FIXTURE)
    expect(ctx.project.compositionSource?.compileError).toBeNull()
  })

  it('write_composition ignores surplus confirmSpend (#1328)', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = await tools.write_composition.execute!(
      { source: LEGAL_KIT_FIXTURE, confirmSpend: true } as never,
      toolCall,
    )
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.compositionId).toBe('authored')
    expect(ctx.project.compositionSource?.source).toBe(LEGAL_KIT_FIXTURE)
  })

  it('write_composition keeps illegal source and returns a line error', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const source = `import fs from 'node:fs'\nexport default () => null\n`
    const outcome = await tools.write_composition.execute!({ source }, toolCall)
    expect(outcome).toMatchObject({ ok: false })
    if (!outcome || typeof outcome !== 'object' || !('ok' in outcome) || outcome.ok) return
    expect(outcome.error).toMatch(/Line 1/)
    expect(ctx.project.compositionSource?.source).toBe(source)
    expect(ctx.project.compositionSource?.compileError).toMatch(/node:fs/)
  })

  it('set_motion_seed changes seed and does not wipe source', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.write_composition.execute!(
      { source: LEGAL_KIT_FIXTURE, motionSeed: 'seed-old' },
      toolCall,
    )
    const outcome = await tools.set_motion_seed.execute!({ motionSeed: 'seed-new' }, toolCall)
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.compositionSource?.source).toBe(LEGAL_KIT_FIXTURE)
    expect(ctx.project.compositionSource?.motionSeed).toBe('seed-new')
  })

  it('patch_composition search-replaces source and keeps compile green', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    await tools.write_composition.execute!(
      { source: LEGAL_KIT_FIXTURE, motionSeed: 'seed-patch-tool' },
      toolCall,
    )
    const outcome = await tools.patch_composition.execute!(
      { find: "text={'Frame '", replace: "text={'Beat '" },
      toolCall,
    )
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.project.compositionSource?.source).toContain("text={'Beat '")
    expect(ctx.project.compositionSource?.compileError).toBeNull()
  })
})
