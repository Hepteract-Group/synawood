# Public API v1

This page is generated from `buildOpenApiV1()`. Change the Zod the routes parse, then regenerate with `npx tsx scripts/render-openapi-v1-docs.ts` from `dashboard/`. Do not treat a hand-written YAML file as the source of truth.

First-party Studio Tools over HTTP. Generated from the Zod bodies the routes parse.

OpenAPI 3.1.0 · Synawood Public API v1.

## Auth

Product API key (Authorization: Bearer mos_…).

## Routes

### POST `/api/v1/add_clip`

`add_clip`

Requires `Idempotency-Key`.

JSON body. Same Zod the HTTP route parses.

Responses: 200, 400, 401, 409.

### GET `/api/v1/health`

`health`

Responses: 200, 401.

### GET `/api/v1/projects/{projectId}`

`get_project_summary`

Responses: 200, 401, 404.

### PATCH `/api/v1/projects/{projectId}`

`save_or_rename_project`

Requires `Idempotency-Key`.

JSON body. Same Zod the HTTP route parses.

Responses: 200, 400, 401, 409.

### POST `/api/v1/remove_clip`

`remove_clip`

Requires `Idempotency-Key`.

JSON body. Same Zod the HTTP route parses.

Responses: 200, 400, 401, 409.

### POST `/api/v1/trim_clip`

`trim_clip`

Requires `Idempotency-Key`.

JSON body. Same Zod the HTTP route parses.

Responses: 200, 400, 401, 409.

## Non-goals

This HTTP API is first-party Studio Tools only. Inbound MCP extras are not listed here (ADR-0081).
