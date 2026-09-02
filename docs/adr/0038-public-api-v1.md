# ADR-0038 — Public API v1 (Studio Tools over HTTP)

**Status:** accepted  
**Date:** 2026-08-22  
**Wave:** Vision 2G · Plan index **19** · Epic [#273](https://github.com/Hepteract-Group/marketing-os/issues/273)  
**Related:** ADR-0001 (Studio Tools), ADR-0018 (no silent spend), ADR-0024 (Product tenancy)  
**Does not supersede:** ADR-0001. The in-app agent still uses tools in-process. This ADR is the **network** face of the **first-party** allowlist.

**Amended 2026-08-24 ([ADR-0081](./0081-inbound-mcp-tools.md)):** `/api/v1` stays first-party Studio Tools only. Inbound MCP tools are in-app (and OSS) extras. They are not proxied on this HTTP API. Outbound MCP (#20) is a separate door and also does not re-export customer MCP.

**Corrects:** Epic [#273](https://github.com/Hepteract-Group/marketing-os/issues/273) children cited this ADR before the file existed. **This ADR is the contract.**

## Context

Founders will want scripts and later a marketplace to call “make an ad” without opening Studio. Temptation: a second command vocabulary. That would drift from Studio Tools and skip spend gates.

## Decision

### 1. `/api/v1` wraps Studio Tools

Each public route maps 1:1 to an allowlisted tool name + Zod input. No extra verbs. Confirm-spend still required when estimated £ > 0 (ADR-0018).

### 2. Product API keys, not user passwords

Keys live in Postgres (hashed), scoped to one `productId`, created by an `owner`. `withApiKey` is the middleware. Rate limits are per key. Dashboard session auth stays for `/api/studio/*`.

### 3. Idempotency + webhooks

`Idempotency-Key` header stores request hash → response for mutating routes. Webhooks notify `job.ready` / `job.failed` for long generation. Delivery is at-least-once with signed payloads.

### 4. OpenAPI from Zod (#278)

The published spec is generated from the same Zod schemas the routes parse. Hand-written OpenAPI is not the source of truth. Docs (`docs/api/v1`, #281) render that spec.

### 5. `mos-sdk-ts` is optional (#282)

A thin typed client generated from the spec may live under `packages/mos-sdk-ts`. It is a stub until endpoint parity (#277) exists. Do not publish to npm in v1.

## Consequences

- Schema (#274) before middleware (#275), idempotency (#276), and route parity (#277).
- OpenAPI (#278) after at least one v1 route exists so the generator has a schema to read.
- Tests (#283) cover contracts, idempotency replay, and webhook signatures.

## Rejected

- A separate RPC language (GraphQL, tRPC public) in v1.
- Using the Studio Agent reasoner on every API call (cost + non-determinism). Tools only.
- the private example-scoped keys that ignore `productId`.
