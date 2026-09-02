# Contributing

This repository is the Apache-2.0 core of Synawood.

1. Open an issue describing the change.
2. Fork, or branch from `main` as `fix|feat|chore|docs/<issue>-<slug>`.
3. Keep the diff small. Functional TypeScript only.
4. Run `npm run test`, `npm run typecheck`, and `npm run format` (if Prettier is set up) before you open a pull request.
5. Do not commit `.env` files, API keys, or production URLs.

`products/demo/` is a fixture kit. Do not add a marketed customer pack to git.

Public CI is build and test only. Do not point Actions at someone else’s Vercel team or production database.
