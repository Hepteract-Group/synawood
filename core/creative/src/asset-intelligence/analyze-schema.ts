/** Wave 2J / #585 — Analyze-on-index schema helpers (ADR-0053). */

import { createHash } from 'node:crypto'
import { z } from 'zod'

export const ANALYZE_KINDS = ['segment', 'compliance', 'highlight', 'custom'] as const
export type AnalyzeKind = (typeof ANALYZE_KINDS)[number]

export const analyzeKindSchema = z.enum(ANALYZE_KINDS)

export type JsonSchemaObject = {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
}

export const analyzeSchemaId = (schema: unknown): string => {
  const canonical = JSON.stringify(schema ?? {})
  return createHash('sha256').update(canonical).digest('hex').slice(0, 40)
}

const extractJsonObject = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced?.[1] ?? text).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Analyze VLM response did not include a JSON object')
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown
}

export const parseAnalyzeJsonResult = (text: string): Record<string, unknown> => {
  const parsed = extractJsonObject(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Analyze VLM response JSON must be an object')
  }
  return parsed as Record<string, unknown>
}

export const validateAnalyzeResult = (
  result: Record<string, unknown>,
  schema: JsonSchemaObject,
): Record<string, unknown> => {
  const required = schema.required ?? []
  for (const key of required) {
    if (!(key in result)) {
      throw new Error(`Analyze result missing required key “${key}”`)
    }
  }
  return result
}

export const fixtureAnalyzeResult = (schema: JsonSchemaObject): Record<string, unknown> => {
  const properties = schema.properties ?? {}
  const out: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(properties)) {
    const type =
      def && typeof def === 'object' && 'type' in def ? String((def as { type?: string }).type) : ''
    if (key === 'summary' || type === 'string') out[key] = 'ci-stub analyze fixture'
    else if (type === 'number') out[key] = 0
    else if (type === 'boolean') out[key] = false
    else if (type === 'array') out[key] = []
    else out[key] = {}
  }
  if (Object.keys(out).length === 0) out.summary = 'ci-stub analyze fixture'
  return out
}
