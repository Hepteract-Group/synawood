# ADR-0078 — Installable PWA, online-only

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** SaaS / mobile chrome · Issue [#842](https://github.com/Hepteract-Group/marketing-os/issues/842)  
**Related:** [ADR-0067](./0067-saas-public-identity.md), [docs/ui/responsive.md](../ui/responsive.md)

## Context

Operators will open Synawood from a phone home screen (Studio stack at 1100px). Chrome/Edge/Android need a Web App Manifest to offer **Install**. iOS uses Add to Home Screen. A service worker would enable offline and push, and would also cache-bust, intercept auth cookies, and fight Next.js App Router. We do not need offline Studio.

## Decision

**Path A:** installable, **online-only**.

1. Ship `dashboard/app/manifest.ts` (`name` Synawood, `short_name` Synawood, `display: standalone`, `start_url: /home`).
2. Theme colors match the app (`#0c0e11` / `#4c8dff`). Icons 192 + 512 PNG, `any` + `maskable`, plus Apple touch icon.
3. **No service worker.** No `next-pwa`, Workbox, or `public/sw.js`. Reloading without network shows the browser’s offline page. That is accepted.
4. iOS: `appleWebApp.capable` so Add to Home Screen opens standalone. No iOS push.

## Consequences

- Install prompt appears on Chromium when the site is HTTPS (or localhost).
- Auth cookies still require a live origin. Cached “last frame of Studio” is out of scope.
- A later ADR may add a fetch worker; this one forbids it.
