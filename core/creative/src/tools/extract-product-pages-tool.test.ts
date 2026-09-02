import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { createStudioTools } from './studio-tools'
import type { StudioToolContext } from './types'

vi.mock('../extract/enqueue-product-extract-job', () => ({
  enqueueProductExtractJob: vi.fn(async (_input: { urls: string[] }) => ({
    job: {
      id: 'job-product-extract-1',
      status: 'queued',
      role: 'extract',
    },
    estimatedGbp: 0.05,
    urls: ['https://povotra.com/'],
  })),
}))

const makeCtx = (overrides?: Partial<StudioToolContext>): StudioToolContext => {
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
    persist: true,
    toolTrace: [],
    confirmSpend: true,
    userMessage:
      'Extract this product page and keep usable stills in the Extracts bin: https://povotra.com',
    ...overrides,
  }
}

describe('extract_product_pages (#1365)', () => {
  it('is a Studio tool', () => {
    const tools = createStudioTools(makeCtx())
    expect(tools.extract_product_pages).toBeDefined()
    expect(String(tools.extract_product_pages.description)).toMatch(/Extracts bin/)
  })

  it('enqueues product_pages extract from the pasted URL', async () => {
    const { enqueueProductExtractJob } = await import('../extract/enqueue-product-extract-job')
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = await tools.extract_product_pages.execute!({ urls: ['https://povotra.com'] }, {
      toolCallId: '1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({
      ok: true,
      data: { jobId: 'job-product-extract-1' },
    })
    expect(enqueueProductExtractJob).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'demo',
        projectId: ctx.projectId,
        urls: ['https://povotra.com'],
        confirmSpend: true,
      }),
    )
  })

  it('pulls the URL from the user message when the model omits urls', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = await tools.extract_product_pages.execute!({}, {
      toolCallId: '1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: true, data: { jobId: 'job-product-extract-1' } })
  })

  it('fails closed when there is no public URL', async () => {
    const ctx = makeCtx({ userMessage: 'extract the product page please' })
    const tools = createStudioTools(ctx)
    const outcome = await tools.extract_product_pages.execute!({}, {
      toolCallId: '1',
      messages: [],
    } as never)
    expect(outcome).toMatchObject({ ok: false })
    expect(String((outcome as { error?: string }).error)).toMatch(/public URL/)
  })
})
