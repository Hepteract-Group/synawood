import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { intentAudienceSchema, intentSchema } from '../intent/schema'
import { createEmptyProject } from '../project/schema'
import {
  formatGeminiFunctionSchemaIssues,
  listGeminiFunctionSchemaIssues,
} from './gemini-function-schema'
import { createStudioTools } from './studio-tools'
import type { StudioToolContext } from './types'

const jsonSchemaFor = (schema: z.ZodType): unknown => z.toJSONSchema(schema)

describe('listGeminiFunctionSchemaIssues', () => {
  it('flags tuple prefixItems the way Gemini 400s them', () => {
    const tuple = z.tuple([z.number(), z.number()])
    const issues = listGeminiFunctionSchemaIssues(jsonSchemaFor(tuple))
    expect(issues.some((issue) => issue.reason.includes('tuple'))).toBe(true)
  })

  it('accepts a length-2 number array (homogeneous items object)', () => {
    const pair = z.array(z.number().int().min(0).max(120)).min(2).max(2)
    expect(listGeminiFunctionSchemaIssues(jsonSchemaFor(pair))).toEqual([])
  })
})

describe('Studio tool schemas vs Gemini proto', () => {
  it('does not emit tuple items on audience.ageRange', () => {
    const audienceIssues = listGeminiFunctionSchemaIssues(jsonSchemaFor(intentAudienceSchema))
    const intentIssues = listGeminiFunctionSchemaIssues(jsonSchemaFor(intentSchema))
    expect(formatGeminiFunctionSchemaIssues([...audienceIssues, ...intentIssues])).toBe('')
  })

  it('keeps every Studio tool JSON schema Gemini-safe', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const ctx: StudioToolContext = {
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
    const tools = createStudioTools(ctx)
    const failures: string[] = []
    for (const [name, entry] of Object.entries(tools)) {
      const schema = entry.inputSchema
      if (!schema || typeof schema !== 'object' || !('toJSONSchema' in schema)) {
        failures.push(`${name}: missing Zod inputSchema`)
        continue
      }
      const json = z.toJSONSchema(schema as z.ZodType)
      const issues = listGeminiFunctionSchemaIssues(json, name)
      if (issues.length > 0) {
        failures.push(`${name}\n${formatGeminiFunctionSchemaIssues(issues)}`)
      }
    }
    expect(failures).toEqual([])
  })
})
