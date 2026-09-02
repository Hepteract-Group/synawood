# Schedule and publish (Work board)

Contract: [ADR-0065](../adr/0065-schedule-after-approve.md), [ADR-0064](../adr/0064-postiz-public-api-adapter.md). Manual paste already lives on the Work board ([content-pipeline-ux.md](./content-pipeline-ux.md)).

## What the founder does

1. **Approve** a Final in Studio ([review-gates.md](./review-gates.md)). That does not post.
2. Open **Work board** (`/content`). Click the card: **Schedule**, **Post now**, or **Paste URL**. The paste field is on the card after Approve — not on the empty calendar.
3. If Postiz is bound: pick organic channel + time (or now). Modal on start; minimize OK.
4. While Synawood talks to Postiz: **banner** (“Scheduling to LinkedIn…”) that survives reload.
5. Card becomes **Scheduled**, then **Posted** with the live link — or **Failed** with retry/cancel.
6. Blog / email / ads, or Postiz down: paste the live URL as today (`manual_posted`).

Connecting Twitter/LinkedIn/TikTok accounts happens **in Postiz** (new tab from Settings → **Open Postiz**). Synawood Settings only picks which connected account is `x_founder` / `linkedin_founder` / `tiktok_organic`. v1 uses **our** Postiz instance plus one API key — not Postiz Cloud, and not a per-customer OAuth product. Leaving Synawood briefly for Postiz OAuth is required; do not iframe it.

## Must not miss

| If this is true | They see |
|---|---|
| Schedule in flight | Banner + minimizable modal — not a greyed button |
| Postiz not configured | Modal: bind in Settings, or paste URL |
| Channel not mapped | Modal: **This channel has no Postiz account** + Open Settings |
| Postiz is down | Modal: **Postiz is down** + paste URL / try again — not a blank or generic error |
| Postiz returned ERROR | Failed banner on the card + cause |
| Page refresh mid-schedule | Banner returns from **server** state |

## Not this surface

- Studio chat (`schedule_post` is not a v1 Studio Tool).
- A `/schedule` calendar that clones Postiz.
- Approve.
- AI Media.

## Empty copy (use these, don’t improvise)

- No Product: **No active Product** + Open Products.
- Postiz env missing: **Postiz is not configured** + Open Settings / paste URL.
- Channel unbound: **This channel has no Postiz account** + Open Settings / paste URL.
- Postiz down: **Postiz is down** + paste URL / try Schedule again.

## Settings bind (`/settings/channels`)

Connecting accounts happens in Postiz (**Open Postiz**). This page only binds Synawood `x_founder` / `linkedin_founder` / `tiktok_organic` to a connected account. Paid ads, blog, and email are not on this page.

| If this is true | They see |
|---|---|
| No Product | **No active Product** + Open Products |
| Postiz env missing | Full-page **Postiz is not configured** |
| No Postiz accounts | Full-page **No Postiz accounts connected** — not a tiny chip |
| Existing bindings, no live account list | **Bound to** the stored id + **Unbind** — not a silent empty state |
| None of the three channels bound | Full-page **These channels have no Postiz account** plus the three pickers |
| Ads / blog / email | Persistent note: Postiz is organic X / LinkedIn / TikTok. Paid ads stay in their tools; paste the live URL on the Final’s Work board card. |
| Picker options | Only accounts that match that Synawood channel (X / LinkedIn / TikTok). One Postiz account cannot bind to two channels. |

Use the empty copy above. Extra for this page:

- Postiz env missing: **Postiz is not configured**
- No Postiz accounts: **No Postiz accounts connected** (Open Postiz, then reload)
- Ads bind: paid ads are not posted through Postiz; paste the live URL on the Final’s Work board card.
