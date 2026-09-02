import { z } from 'zod'
import { PRODUCT_NAME } from './product-name'
import { CLIP_BODY_SCHEMA, V1_CLIP_TOOL_NAMES } from './v1-clip'
import { healthResponseSchema } from './v1-health'
import { fullPatchBodySchema, renamePatchBodySchema } from './v1-project'

const jsonSchemaFor = (schema: z.ZodType): Record<string, unknown> => {
  const raw = z.toJSONSchema(schema) as Record<string, unknown>
  const { $schema: _schema, ...rest } = raw
  return rest
}

const bearerSecurity: { bearerAuth: string[] }[] = [{ bearerAuth: [] }]

const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header' as const,
  required: true,
  schema: { type: 'string', minLength: 1 },
}

const jsonBody = (schema: z.ZodType) => ({
  required: true,
  content: {
    'application/json': {
      schema: jsonSchemaFor(schema),
    },
  },
})

const projectIdParam = {
  name: 'projectId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

type OpenApiParameter = {
  name: string
  in: 'header' | 'path'
  required: boolean
  schema: Record<string, unknown>
}

type OpenApiResponse = {
  description: string
  content?: { 'application/json': { schema: Record<string, unknown> } }
}

type OpenApiOperation = {
  operationId: string
  security: { bearerAuth: string[] }[]
  parameters?: OpenApiParameter[]
  requestBody?: {
    required: boolean
    content: { 'application/json': { schema: Record<string, unknown> } }
  }
  responses: Record<string, OpenApiResponse>
}

type OpenApiPathItem = {
  get?: OpenApiOperation
  post?: OpenApiOperation
  patch?: OpenApiOperation
}

export type OpenApiV1Spec = {
  openapi: string
  info: { title: string; version: string; description: string }
  components: { securitySchemes: Record<string, unknown> }
  paths: Record<string, OpenApiPathItem>
}

export const buildOpenApiV1 = (): OpenApiV1Spec => {
  const clipPaths: Record<string, OpenApiPathItem> = Object.fromEntries(
    V1_CLIP_TOOL_NAMES.map((name) => {
      const schema = CLIP_BODY_SCHEMA[name]
      return [
        `/api/v1/${name}`,
        {
          post: {
            operationId: name,
            security: bearerSecurity,
            parameters: [idempotencyHeader],
            requestBody: jsonBody(schema),
            responses: {
              '200': { description: 'Tool result' },
              '400': { description: 'Invalid body or missing Idempotency-Key' },
              '401': { description: 'Invalid API key' },
              '409': {
                description: 'Revision conflict or Idempotency-Key reuse with a different body',
              },
            },
          },
        },
      ]
    }),
  )

  const spec = {
    openapi: '3.1.0',
    info: {
      title: `${PRODUCT_NAME} Public API`,
      version: 'v1',
      description:
        'First-party Studio Tools over HTTP. Generated from the Zod bodies the routes parse.',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Product API key (Authorization: Bearer mos_…).',
        },
      },
    },
    paths: {
      '/api/v1/health': {
        get: {
          operationId: 'health',
          security: bearerSecurity,
          responses: {
            '200': {
              description: 'Key is valid',
              content: {
                'application/json': { schema: jsonSchemaFor(healthResponseSchema) },
              },
            },
            '401': { description: 'Invalid API key' },
          },
        },
      },
      '/api/v1/projects/{projectId}': {
        get: {
          operationId: 'get_project_summary',
          security: bearerSecurity,
          parameters: [projectIdParam],
          responses: {
            '200': { description: 'Project summary plus project JSON' },
            '401': { description: 'Invalid API key' },
            '404': { description: 'Project not found' },
          },
        },
        patch: {
          operationId: 'save_or_rename_project',
          security: bearerSecurity,
          parameters: [projectIdParam, idempotencyHeader],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [jsonSchemaFor(renamePatchBodySchema), jsonSchemaFor(fullPatchBodySchema)],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Saved project' },
            '400': { description: 'Invalid body' },
            '401': { description: 'Invalid API key' },
            '409': { description: 'Revision conflict' },
          },
        },
      },
      ...clipPaths,
    },
  }

  return spec
}

export const OPENAPI_V1_PATHS = Object.keys(buildOpenApiV1().paths).sort()
