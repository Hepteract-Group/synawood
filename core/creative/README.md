# core/creative (`@synawood/creative`)

Product-agnostic Creative Studio package.

## Surfaces

### Plan 00 — persistence

- `src/persistence/blob-key.ts` — pure blob key builder (`local/` prefix for dev)
- `src/persistence/blob.ts` — Azure Blob put/get/delete + signed URLs
- `src/persistence/supabase.ts` — service-role client + the private example project guard
- `npm run smoke:blob` — local Blob smoke (requires env)

### Plan 01 — project + Remotion

- `src/project/` — Zod Studio Project schema, load/save (optimistic revision), clip/overlay ops, upload with compensating Blob delete
- `src/compositions/` — `talking_head_60`, Remotion root/entry, props mapper
- `src/render/` — enqueue + status (safe for Next); `run-local` for the worker only
- `npm run render:local -- --job <id>` (repo root) — local encode → Blob + `render_jobs`

### Plan 02 — agent harness

- `src/agent/` — `runTurn`, system prompt, marketing skill selection, mock reasoner, chat store
- `src/tools/` — allowlisted Studio Tools (no shell / arbitrary network)
- Default `MODEL_PROFILE=founder-edit` (Gateway reasoner + `openai/tts-1` + `openai/whisper-1`). Chat falls back to the deterministic stub reasoner only when `AI_GATEWAY_API_KEY` / `OPENAI_API_KEY` are unset. TTS/STT require `AI_GATEWAY_API_KEY`.

## Import rules

- Dashboard **client** (`'use client'`) must import `@synawood/creative/project/client` (or a deep path like `@synawood/creative/project/schema`). Do **not** import `@synawood/creative/project` from the browser — that barrel re-exports load/save/operations and pulls `node:crypto`.
- Dashboard **server** routes may import `@synawood/creative`, `@synawood/creative/project`, `@synawood/creative/compositions`, `@synawood/creative/render`, `@synawood/creative/agent`, `@synawood/creative/tools`.
- Do **not** import `@synawood/creative/render/run-local` from Next routes — it pulls Remotion bundler/native deps.

Contracts: `docs/architecture/agent-harness.md`, `studio-tools.md`, `marketing-skills.md`, ADRs `0001`, `0008`.
