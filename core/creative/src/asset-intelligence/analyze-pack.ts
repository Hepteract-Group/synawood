/** Wave 2J / #660 — pin Analyze kind to first-party packs (ADR-0053). */

import {
  analyzeSchemaId,
  fixtureAnalyzeResult,
  type AnalyzeKind,
  type JsonSchemaObject,
} from './analyze-schema'
import {
  COMPLIANCE_SCHEMA,
  compliancePrompt,
  fixtureComplianceResult,
  type CompliancePromptInput,
} from './compliance-pack'
import { HIGHLIGHT_SCHEMA } from './highlight-pack'
import { SEGMENT_SCHEMA } from './segment-shots'

export const resolveAnalyzePack = (input: {
  kind: AnalyzeKind
  schema?: JsonSchemaObject
  prompt: string
  compliance?: CompliancePromptInput
}): { schema: JsonSchemaObject; prompt: string; schemaId: string } => {
  if (input.kind === 'compliance') {
    return {
      schema: COMPLIANCE_SCHEMA,
      prompt: `${compliancePrompt(input.compliance)}\n${input.prompt}`.trim(),
      schemaId: analyzeSchemaId(COMPLIANCE_SCHEMA),
    }
  }
  if (input.kind === 'highlight') {
    return {
      schema: HIGHLIGHT_SCHEMA,
      prompt: input.prompt,
      schemaId: analyzeSchemaId(HIGHLIGHT_SCHEMA),
    }
  }
  if (input.kind === 'segment') {
    return {
      schema: SEGMENT_SCHEMA,
      prompt: input.prompt,
      schemaId: analyzeSchemaId(SEGMENT_SCHEMA),
    }
  }
  if (!input.schema) {
    throw new Error('analyze_asset custom kind needs a JSON schema')
  }
  return {
    schema: input.schema,
    prompt: input.prompt,
    schemaId: analyzeSchemaId(input.schema),
  }
}

/** ci-stub JSON lives on the pack, not a `kind` switch in `analyze-schema`. */
export const fixtureAnalyzePackResult = (input: {
  kind: AnalyzeKind
  schema: JsonSchemaObject
}): Record<string, unknown> => {
  if (input.kind === 'compliance') return fixtureComplianceResult()
  return fixtureAnalyzeResult(input.schema)
}
