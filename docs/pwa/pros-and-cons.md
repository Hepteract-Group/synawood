# PWA path A — installable, online-only

**Decision:** [ADR-0078](../adr/0078-installable-pwa.md). Summary: [README.md](./README.md).

## Path A (shipped)

Installable web app. **No** fetch worker. Reloading offline shows the browser’s own page.

| | |
|---|---|
| **Pros** | Home-screen icon; Chromium install prompt; no cache fights with Next.js; auth cookies stay on the live origin |
| **Cons** | No offline Studio; iOS has no install banner (Share → Add to Home Screen); production needs HTTPS |

## Path B (rejected here)

Service worker + Workbox / `next-pwa`. Would enable a stale shell and fight App Router + cookie auth. A later ADR can revisit.
