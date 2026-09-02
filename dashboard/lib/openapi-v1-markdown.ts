import type { OpenApiV1Spec } from './openapi-v1'

const METHODS = ['get', 'post', 'patch'] as const

export const renderOpenApiV1Markdown = (spec: OpenApiV1Spec): string => {
  const bearer = spec.components.securitySchemes.bearerAuth as { description?: string }
  const lines: string[] = [
    '# Public API v1',
    '',
    'This page is generated from `buildOpenApiV1()`. Change the Zod the routes parse, then regenerate with `npx tsx scripts/render-openapi-v1-docs.ts` from `dashboard/`. Do not treat a hand-written YAML file as the source of truth.',
    '',
    spec.info.description,
    '',
    `OpenAPI ${spec.openapi} · ${spec.info.title} ${spec.info.version}.`,
    '',
    '## Auth',
    '',
    bearer.description ?? 'Product API key in `Authorization: Bearer`.',
    '',
    '## Routes',
    '',
  ]

  for (const path of Object.keys(spec.paths).sort()) {
    const item = spec.paths[path]
    if (!item) continue
    for (const method of METHODS) {
      const op = item[method]
      if (!op) continue
      lines.push(`### ${method.toUpperCase()} \`${path}\``)
      lines.push('')
      lines.push(`\`${op.operationId}\``)
      lines.push('')
      const needsIdempotency = op.parameters?.some((param) => param.name === 'Idempotency-Key')
      if (needsIdempotency) {
        lines.push('Requires `Idempotency-Key`.')
        lines.push('')
      }
      if (op.requestBody) {
        lines.push('JSON body. Same Zod the HTTP route parses.')
        lines.push('')
      }
      const statuses = Object.keys(op.responses).sort()
      lines.push(`Responses: ${statuses.join(', ')}.`)
      lines.push('')
    }
  }

  lines.push('## Non-goals')
  lines.push('')
  lines.push(
    'This HTTP API is first-party Studio Tools only. Inbound MCP extras are not listed here (ADR-0081).',
  )
  lines.push('')
  return lines.join('\n')
}
