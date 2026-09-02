# Shipping a product Guide

When you ship a **user-visible** surface (new Studio chrome, a settings page, a first-run path), the same PR must either:

1. Add a catalogue id under `dashboard/lib/guides/catalogue.ts`, or
2. Say in the PR that **welcome covers it** (the existing Home / Studio / Members tour already names that place).

Copy tweaks to an existing Guide do **not** get a new id (people who dismissed it must not be nagged). A new tour uses a **new** id (`studio-chat-titles-v1`).

## Feature Guides

- `kind: 'feature'`
- `releasedAt`: the merge/deploy instant you care about (ISO).
- People whose **previous** login is before `releasedAt` see it **once**, on the next login.
- People who signed up after `releasedAt` skip it unless `includeNewUsers: true`.
- Auto-prompt is **one Guide per login** (welcome first, else the oldest pending feature).

## QA

Set `GUIDE_FORCE_ID=<catalogue-id>` in local or preview `.env`. Production ignores it (`VERCEL_ENV=production`). Force still skips a Guide the user already dismissed or completed — replay from **Settings → Guides**.

Replay any Guide from **Settings → Guides**.

Do **not** flip production `AUTH_ACCESS_MODE=saas` in a feature PR.
