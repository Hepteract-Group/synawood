/** Zod tuples emit prefixItems; Gemini proto `items` is a single schema, so the whole turn 400s. */

export type GeminiFunctionSchemaIssue = {
  path: string
  reason: string
}

const walk = (schema: unknown, path: string): GeminiFunctionSchemaIssue[] => {
  if (schema === null || typeof schema !== 'object') return []
  const node = schema as Record<string, unknown>
  const issues: GeminiFunctionSchemaIssue[] = []

  if (Array.isArray(node.type)) {
    issues.push({
      path,
      reason: 'type is a list; Gemini proto type is a single string',
    })
  }
  if (Array.isArray(node.items)) {
    issues.push({
      path,
      reason: 'items is a list; Gemini proto items is a single schema (no tuples)',
    })
  }
  if (Array.isArray(node.prefixItems)) {
    issues.push({
      path,
      reason: 'prefixItems (tuple) is sent as list-valued items and Gemini rejects it',
    })
  }

  const properties = node.properties
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      issues.push(...walk(value, `${path}.properties.${key}`))
    }
  }

  if (node.items && !Array.isArray(node.items)) {
    issues.push(...walk(node.items, `${path}.items`))
  }

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branch = node[key]
    if (Array.isArray(branch)) {
      branch.forEach((item, index) => {
        issues.push(...walk(item, `${path}.${key}.${index}`))
      })
    }
  }

  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    issues.push(...walk(node.additionalProperties, `${path}.additionalProperties`))
  }

  return issues
}

export const listGeminiFunctionSchemaIssues = (
  schema: unknown,
  path = '$',
): GeminiFunctionSchemaIssue[] => walk(schema, path)

export const formatGeminiFunctionSchemaIssues = (
  issues: readonly GeminiFunctionSchemaIssue[],
): string => issues.map((issue) => `${issue.path}: ${issue.reason}`).join('\n')
