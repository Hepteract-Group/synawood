# AGENTS.md — Working on the Synawood Apache core

This tree is the **public Apache-2.0 core**. It is a snapshot, not the source of truth.

## What this repo is

Synawood is a go-to-market operating system: runbooks, a Next.js dashboard, Creative Studio (chat-to-timeline), and automations. Customer brand lives on an Organization you create in the app. `products/demo/` is a fixture kit so Studio boots without a customer.

## What you must not do

- **Do not push to `Hepteract-Group/synawood` from a coding agent.** Public history is an empty-history snapshot from the private SoT. Open a pull request only if a human asked you to contribute here.
- **Do not file product bugs only on this public repo** if you have access to the private SoT (`Hepteract-Group/synawood-os`). Issues and implementation land there first.
- **Do not commit secrets.** Bring your own API keys. Copy names from `.env.example`. Never paste production URLs or keys into git.
- **Do not treat this snapshot as a deploy pipeline.** Public CI is build and test only. It must not deploy to anyone’s hosted dashboard.

## How to run it

See [docs/architecture/self-host.md](docs/architecture/self-host.md). Short path: install Node 22+, copy env templates, start Postgres (local Supabase or your own), `npm ci`, `npm run dev` or `npm run local:up` if you use the Docker stack.

## Studio vs coding agents

The **Studio Agent** is the in-product tool loop that edits a Studio Project ([docs/architecture/agent-harness.md](docs/architecture/agent-harness.md)). It is not Cursor. Do not install LangChain or a multi-agent framework for Studio without a new ADR that supersedes [ADR-0001](docs/adr/0001-studio-agent-harness.md).

Coding-agent skills under `.agents/skills/` are for people (and agents) changing this repo. They are not Studio Tools.

## License

Apache-2.0. See `LICENSE` and `NOTICE`. Fixture kits under `products/` in a private tree are not this public license.
