# AGENTS.md — Working on Synawood

This repository is the Apache-2.0 core. Bring your own keys. Do not commit secrets.

## What this is

Synawood is a go-to-market operating system: runbooks, a Next.js dashboard, Creative Studio (chat-to-timeline), and automations. Customer brand lives on an Organization you create in the app. `products/demo/` is a fixture kit so Studio boots without a customer.

## Rules

- **Do not commit secrets.** Copy names from `.env.example`. Never paste production URLs or keys into git.
- **Do not treat this tree as someone else’s deploy pipeline.** CI here is build and test only. It must not deploy a hosted dashboard or use production database URLs.
- **Prefer pull requests** on the default branch. Do not force-push `main`.
- **Functional TypeScript.** No classes unless a framework requires them.

## How to run it

[Self-host](docs/architecture/self-host.md). Short path: Node 22+, Docker, `npm ci`, `npm run local:up`, open http://localhost:3000.

## Studio vs coding agents

The **Studio Agent** is the in-product tool loop that edits a Studio Project ([agent harness](docs/architecture/agent-harness.md)). It is not Cursor. Do not install LangChain or a multi-agent framework for Studio without a new ADR that supersedes [ADR-0001](docs/adr/0001-studio-agent-harness.md).

Coding-agent skills under `.agents/skills/` are for people changing this repo. They are not Studio Tools.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
