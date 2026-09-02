# AI Media (founder)

Sidebar **AI Media** → `/ai-media`. Architecture: [ai-media.md](../architecture/ai-media.md).

## What you see

One Product’s Generation Jobs, newest first.

1. **Header** — title **AI Media**, lede that this is generated work for this Product, **Open Studio** to make more.
2. **Banner** while any job is queued or running: “N jobs still running” (or the one role). Survives reload.
3. **Ready row** — you can see or hear the file (still / clip / audio), then role, Ready, time, £, project. **Place in Studio** is the primary action (`add_generated_asset`, then `add_clip`).
4. **Failed row** — error text first. **Retry** second (modal on start, minimize; banner while it runs; spend confirm if £>0). Open Studio still available.
5. **No file jobs** (extract / index / transcribe) — status row only. No fake thumbnail.

## Empty / blocked

- No Product: **No active Product** + Open Products. Not a blank panel.
- No jobs: **No generation jobs yet** + Open Studio.
- Signed out: Sign in to `/login?next=/ai-media`.

## Not here

Prompt box. Model pickers. Timeline. Approve. Tool traces (those are Usage).
