# API console (UI)

Visual spec. Behaviour: [ux/api-console.md](../ux/api-console.md). Settings shell: [dashboard-shell.md](./dashboard-shell.md). Tokens: [tokens.md](./tokens.md).

## Route

`/settings/api` (Settings → **API**). Owner-only. Editors see the page title plus “Only owners can create API keys.” — not a blank 404.

## Page

1. Title: **API**
2. Intro one line: call first-party Studio Tools over HTTP with a Product key.
3. Sections: **Keys**, **Webhooks**

### Key row

| Element | Spec |
|---|---|
| Name | Operator label |
| Prefix | monospace, first 12 chars |
| Last used | relative time or “Never” |
| Revoke | danger text button |

### Create-key dialog

Max width ~480px. Field: name. Submit: **Create key**. Success state replaces the form with the plaintext secret, a **Copy** button, and “You will not see this again.” Primary after copy: **Done**.

### Webhook row

URL (truncated, full on hover/detail), event chips, delivery status (pending / delivered / failed). Failed: status word + last error sentence under the row.

### Add-webhook dialog

URL field, event checkboxes default on for `job.ready` and `job.failed`, consent that job payloads leave Synawood. Hosted: reject `http://localhost` / private hosts with inline error, not only a toast.
