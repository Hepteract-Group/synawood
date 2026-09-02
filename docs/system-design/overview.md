# System overview

Synawood is a **go-to-market operating system**: durable procedures (runbooks), a dashboard for status and Studio work, and automations that eventually encode what humans already ran by hand.

It is **not** a social media scheduler (a scheduler is an adapter, not this product), not a consumer editor sold as the whole company, and not a dumping ground for one-off scripts. Creative Studio **does** ship the craft advertisers need — including motion graphics the agent authors in Remotion. Overlap with other editors is irrelevant.

## Primary actors

- **Operator** — executes runbooks, records footage, Approves Final assets, decides kill/scale.
- **Coding agents** — implement and maintain the repo under `AGENTS.md`.
- **Studio Agent** — in-product LLM loop that edits Studio Projects (separate from coding agents).

## Product kits

This public tree does not ship a marketed customer pack. `products/demo/` is a fixture kit. Customer brand, ICP, and claims live on the Organization in the app (Brand Studio / extract URL). Anything that names a real marketed product belongs in that customer’s data, not in git.
