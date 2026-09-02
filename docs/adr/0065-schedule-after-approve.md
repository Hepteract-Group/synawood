# ADR-0065 — Schedule after Approve; posted URL returns to Synawood

**Status:** accepted  
**Date:** 2026-08-22  
**Plan:** **29** · Epic [#787](https://github.com/Hepteract-Group/marketing-os/issues/787)  
**Related:** ADR-0010, ADR-0063, ADR-0064  
**UX:** [schedule-and-publish.md](../ux/schedule-and-publish.md) · [review-gates.md](../ux/review-gates.md)

## Context

Approve already retains a Final. The Work board already pastes posted URLs onto `publish_records`. The shell still lists **Schedule** as deferred, which reads as a missing calendar app.

Founders need to *send* an approved cut to X / LinkedIn / TikTok at a time, then see the live URL without hunting Postiz. They also need the old paste path when Postiz is down or the channel is blog/email/ads.

Postiz can POST a webhook when a post publishes (Settings → Webhooks; not configured via Public API). Cloud webhooks are plan-gated; self-host is not. Postiz Cloud cannot reach `localhost`. List/get posts expose `state` (`QUEUE` | `PUBLISHED` | `ERROR` | `DRAFT`) and `releaseURL`.

## Decision

### 1. Schedule is a Work board action, not a nav calendar

v1 **Schedule** / **Post now** lives on the Work board / Final card after Approve ([#808](https://github.com/Hepteract-Group/marketing-os/issues/808)). It talks to `PublishAdapter` only.

Do **not** ship a top-level `/schedule` calendar that duplicates Postiz’s UI. Connecting social accounts stays in Postiz; Synawood Settings only binds Synawood `channel` → integration id (ADR-0064).

Shell copy: Observability stays deferred. Schedule is this control, not a Plan 06 placeholder page.

### 2. Human starts it; reload must not lose it

Follow the Studio async pattern:

- **Modal** on start and on completion (founder can minimize).
- **Persistent banner** while the schedule request or posted-status job is in flight — not a button label.
- **Poll server** after reload. Never gate Schedule/Export on a client-only flag.

Failed schedule / Postiz `ERROR` is a **banner + card** the founder cannot miss ([#807](https://github.com/Hepteract-Group/marketing-os/issues/807)): cause + retry or cancel.

Missing Postiz env or unmapped channel is the **empty/error state of the modal** ([#810](https://github.com/Hepteract-Group/marketing-os/issues/810)): Open Settings, or use paste URL. Not a console log.

### 3. Posted URL: poll first, webhook optional

| Path | Role |
|---|---|
| **Poll** `getStatus` / list posts ([#805](https://github.com/Hepteract-Group/marketing-os/issues/805)) | v1 recovery. Maps `PUBLISHED` + `releaseURL` → Synawood `posted` + `external_url`. `ERROR` → `failed`. |
| **Webhook** ([#806](https://github.com/Hepteract-Group/marketing-os/issues/806)) | Optional faster path. 2xx quickly; idempotent on `postiz_id`. Do not require Cloud webhooks for v1. |
| **Paste URL** ([#809](https://github.com/Hepteract-Group/marketing-os/issues/809)) | Always available → `manual_posted`. Wins if already set; poll must not overwrite a founder paste with empty. |

Local Cloud-webhook smoke needs a tunnel; that is ops, not a product requirement.

### 4. Agent does not publish

Studio Tools stay off Postiz ([studio-tools.md](../architecture/studio-tools.md)). The weekly runbook’s “Schedule” step is this Work board control ([#811](https://github.com/Hepteract-Group/marketing-os/issues/811)), not “go use Postiz as a second app” except for connecting accounts.

## What the user sees

| Moment | Surface |
|---|---|
| After Approve | **Schedule** / **Post now** on the Work board card (and paste URL). |
| In flight | Minimizable modal + **banner** (“Scheduling to X…”). Survives close and reload. |
| Scheduled | Card status **Scheduled**, time visible. |
| Posted | Card shows the **live link**. |
| Failed | Error banner + retry/cancel on the card. |
| Not configured | Modal explains bind channel in Settings, or paste URL. |

## Rejected

- Auto-schedule on Approve.
- A Synawood calendar product that replaces Postiz.
- Client-only “scheduling…” that vanishes on refresh.
- Studio Agent `schedule_post` in v1.
- Making webhook the only way to learn `releaseURL`.
