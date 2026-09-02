# Product Extracts (UX)

Operator-visible public-site stills on the Product. Contract: [ADR-0089](../adr/0089-product-extracts.md). Architecture: [product-extracts.md](../architecture/product-extracts.md). Visual: [ui/product-extracts.md](../ui/product-extracts.md).

Ad Generator **ExtractedBrief** stays the wizard on-ramp ([ad-generator-flow.md](./ad-generator-flow.md)). This flow is the reusable stills tab.

## What they see

Media bin → Media tab modes: **Library | Story | Extracts**.

**Extracts** is a real grid of screenshots and text snippets. Each still shows source URL and quality (**usable** / **weak** / **reject**). Click opens the still. Place puts it on the cut. **Delete** is on the card (then confirm) and in the inspector — it removes the still from the Product for every project. Rejected stills stay in the grid (operator can override the agent).

Not a chip. Not a job log. Not hidden on the extract Generation Job while the agent uses them silently.

## Flow (cannot miss)

1. Operator pastes a public URL (Ad Generator, chat, or plan extra URLs) and starts extract.
2. **Modal** on start (minimize allowed) + **persistent banner** while the extract job runs. Reload polls the job.
3. On ready: Extracts tab has new stills. Score chips are readable without hover.
4. Agent prefers usable stills as generate references / slide backgrounds. Generated stock still fills holes.
5. Generation Plan (when it exists): extra URLs + **Re-extract this turn** (default off). Confirm spend covers crawl + screenshots + vision. Closing the modal leaves the banner.

Local worker missing: banner says so (same as render/generate).

## Empty / error

- No Extracts yet: “Paste a public product URL to capture pages.” Point at extract, not Brand DNA.
- One page failed, others succeeded: banner names the failed URL; other stills remain.
- Auth wall / SSRF block: inline error on the dialog + banner. No silent skip that looks like “done.”

## Non-goals

- Login-walled scrape
- Per-project-only stills
- Auto-writing DNA fields
