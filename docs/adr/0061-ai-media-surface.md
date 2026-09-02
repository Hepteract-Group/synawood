# ADR-0061 — AI Media is the Generation Job review surface

**Status:** accepted  
**Date:** 2026-08-22  
**Plan:** Plan 06 shipped the nav stub; **Plan 28** is the fill-in. Epic [#780](https://github.com/Hepteract-Group/marketing-os/issues/780)  
**Related:** ADR-0005 (generate), ADR-0006 (brand on generate), ADR-0016 (shell IA), ADR-0018 (Usage traces)  
**Amends:** [dashboard-shell.md](../ui/dashboard-shell.md) — `/ai-media` is **not exempt** as a Plan 06 placeholder. The route still needs #782/#783 before the UI matches this contract.  
**Does not supersede:** ADR-0005 (generate still happens in Studio). ADR-0018 (tool traces stay on **Usage**).

## Context

Plan 06 put **AI Media** in the sidebar so the editor chrome could ship. Placeholder pages were allowed (#61). The route still reads as a blank page: no Product, or no jobs, and no way to *see* what a job made.

[#687](https://github.com/Hepteract-Group/marketing-os/issues/687) listed Generation Jobs. That is not the shell contract. The contract is **jobs + generated asset review**. A status list without pictures is easy to miss and easy to confuse with Usage.

ADR-0005 already rejected a separate “generator app.” This ADR names the page so nobody builds one by accident.

## Decision

### 1. `/ai-media` is Product-scoped job + output review

**AI Media** lists this Product’s Generation Jobs (image, video clip, music, speech, extract, index, transcribe, and other `generation_jobs.role` values) and the assets they produced. Reload polls the server. In-flight work is a **persistent banner**, not a button label.

### 2. It is not a generator app

Enqueue of **new** generate stays Studio Tools (`generate_image`, `generate_video_clip`, `generate_music`, …) inside a Studio Project. This page has no prompt box, no “new generation” composer, and no Model Profile picker. Open Studio to make more. Retry of a **failed** job is ADR-0062 — same job, not a new prompt.

### 3. It is not Usage

| Surface | Holds |
|---|---|
| **AI Media** | Generation Jobs and their output assets |
| **Usage** | CostEvent ledger and Studio **tool traces** |
| **Studio** | Timeline, chat, enqueue, Approve |

Spend figures may appear on a job row. The ledger and traces do not move here.

### 4. Empty is a state, not a blank panel

No active Product → **No active Product** + Open Products.  
No jobs → **No generation jobs yet** + Open Studio.  
Unauthorized → Sign in.  
Those are the page. They are not optional chrome around an empty `<section>`.

## Rejected

- Leaving the Plan 06 placeholder copy.
- Folding AI Media into Usage or Settings.
- A Midjourney-style generate UI on `/ai-media`.
- Client-only job lists that vanish on reload.
