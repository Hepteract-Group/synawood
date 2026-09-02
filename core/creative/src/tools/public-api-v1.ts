import { STUDIO_TOOL_NAMES } from './studio-tools'

/** Public `/api/v1` verbs are first-party Studio Tools only (ADR-0038 / #963). */

export const isMcpToolId = (id: string): boolean => id.startsWith('mcp:')

const isMcpRoutePath = (relPath: string): boolean =>
  /(^|[/:])mcp:/.test(relPath) || /(^|\/)mcp\//i.test(relPath)

export const mcpProxyViolations = (input: {
  routeRelPaths: readonly string[]
  openApiText?: string
  verbNames?: readonly string[]
}): string[] => {
  const hits: string[] = []
  for (const path of input.routeRelPaths) {
    if (isMcpRoutePath(path)) hits.push(path)
  }
  if (input.openApiText && /mcp:/.test(input.openApiText)) {
    hits.push('openapi:mcp:')
  }
  for (const name of input.verbNames ?? []) {
    if (isMcpToolId(name)) hits.push(name)
  }
  return hits
}

export const registeredV1VerbsFromPaths = (relPaths: readonly string[]): string[] =>
  relPaths
    .filter((path) => /route\.tsx?$/.test(path))
    .map((path) => path.replace(/\\/g, '/').replace(/\/route\.tsx?$/, ''))

const FIRST_PARTY_TOOL_IDS: readonly string[] = STUDIO_TOOL_NAMES

/**
 * HTTP resources that are not Studio Tool folder names.
 * `health` is the #275 smoke route.
 * `projects/[projectId]` is GET `get_project_summary` + PATCH save/rename (#1073).
 */
export const V1_RESOURCE_ROUTE_IDS = ['health', 'projects/[projectId]'] as const

/** `health` is the #275 smoke route, not a Studio Tool. */
export const isAllowedV1Verb = (id: string): boolean =>
  (V1_RESOURCE_ROUTE_IDS as readonly string[]).includes(id) || FIRST_PARTY_TOOL_IDS.includes(id)
