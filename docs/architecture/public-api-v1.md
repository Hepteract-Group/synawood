# Public API v1

HTTP face of **first-party Studio Tools**. Contract: [ADR-0038](../adr/0038-public-api-v1.md). Does not proxy inbound MCP ([ADR-0081](../adr/0081-inbound-mcp-tools.md)). Operator surface: [ux/api-console.md](../ux/api-console.md), [ui/api-console.md](../ui/api-console.md).

Schema already landed (`product_api_keys`, `api_idempotency`, `product_webhooks`, `webhook_deliveries`). `withApiKey` + `/api/v1/health` exist. Settings console and route parity continue. OpenAPI is generated from the same Zod the routes parse (`buildOpenApiV1`). Contract tests cover 401 without a key, idempotency replay/conflict, and fixture webhook signatures (no live customer HTTP in CI).

## Auth

Product API keys, hashed at rest. Owner creates; plaintext shown **once**. Dashboard session auth stays on `/api/studio/*`. Rate limits per key. Keys are not user passwords.

## Routes

Each public route maps 1:1 to an allowlisted Studio Tool name + the same Zod input. Confirm-spend still required when estimated £ > 0 ([ADR-0018](../adr/0018-studio-agent-trust-model.md)). Hosted wallet debit is the same gate as Studio ([ADR-0082](../adr/0082-hosted-billing-wallet-entitlements.md)) once billing ships.

Do not add extra verbs. Do not run the Studio Agent reasoner on every API call.

## Idempotency

Mutating routes require `Idempotency-Key`. Same key + same request hash replays the stored status and body. Same key + different hash is a conflict. Rows live in `api_idempotency`.

## Webhooks

Operator URL, hashed secret. Events: `job.ready`, `job.failed`. At-least-once delivery with signed payloads. Worker drains `webhook_deliveries`. Generic inbound HTTP webhooks (the other direction) are out of this wave.

## OpenAPI

Published spec is generated from the same Zod the routes parse (`buildOpenApiV1` in the dashboard). Hand-written YAML is not the source of truth. The operator reference is [docs/api/v1](../api/v1/README.md). Optional `mos-sdk-ts` lives at `packages/mos-sdk-ts` as a private stub; do not publish to npm.

## Non-goals

- GraphQL / tRPC public RPC
- Proxying `mcp:*` tools
- the private example-scoped keys that ignore `productId`
- Replacing Studio chat
