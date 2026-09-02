# Progressive Web App (installable, online-only)

Synawood can be **installed** on a phone or desktop (Chrome / Edge / Android **Install app**; iOS **Add to Home Screen**). It still needs a network. There is **no service worker** and **no offline Studio**.

See [ADR-0078](../adr/0078-installable-pwa.md).

## What ships

| Piece | Where |
|---|---|
| Manifest | `/manifest.webmanifest` from `dashboard/app/manifest.ts` |
| Icons | `dashboard/public/icons/icon-{192,512}.png` (+ maskable) |
| Apple touch | `dashboard/public/apple-touch-icon.png` |
| Standalone chrome | `appleWebApp` + `themeColor` on `dashboard/app/layout.tsx` |

`start_url` is `/home`. Theme: background `#0c0e11`, accent `#4c8dff`.

## What does not ship

- Service worker / Workbox / `next-pwa`
- Offline cache of Studio projects or media
- Push notifications
- Changing production `AUTH_ACCESS_MODE`

## Pros and cons (path A)

**Pros:** home-screen icon, standalone window, no cache-bust fights with Next.js, no intercept of auth cookies.

**Cons:** no offline; iOS will not prompt “Install” (user uses Share → Add to Home Screen); Chromium install criteria still need HTTPS in production.

## Check locally

1. `npm run dev` in `dashboard/`
2. Open `http://localhost:3000/manifest.webmanifest` — JSON with `short_name: Synawood`
3. Chrome DevTools → Application → Manifest — icons load, no service worker

## Standalone smoke (localhost and hosted)

Do this in the **installed** window, not a leftover browser tab. There is no service worker.

### Chrome on macOS or Windows (localhost)

1. `npm run dev` in `dashboard/`
2. Open `http://localhost:3000/login`. Under the form, **Install this app** explains iPhone Add to Home Screen and Chrome Install. Chrome may also offer Install in the address bar.
3. Install. Open the installed window. It requests `/home`. Signed out, that is `/login?next=/home` — not the waitlist (`/`).
4. Sign in with Google **in that window**. You should land on `/home`, not stuck on `/auth/callback`.
5. Open a Studio project. Play a Blob clip in the Player.
6. Sign out. The installed window stays chrome-free and shows login again.

### Chrome on macOS or Windows (hosted)

Same steps on the HTTPS origin. Install from `/login` or Settings. After Google sign-in in the installed window, you land on `/home`. Open Studio, play a Blob clip, sign out.

### iPhone

1. Safari: open localhost on the LAN, or the hosted origin. Settings also shows **Install this app** (not a campaign).
2. Share → Add to Home Screen.
3. Open the icon — no Safari chrome. Sign in with Google **in that window** (Home Screen apps have their own cookies).
4. You should land on `/home`, not stuck on `/auth/callback`.
5. Open Studio. Play a Blob clip in the Player. Sign out.

Offline reload shows the browser’s own page.
