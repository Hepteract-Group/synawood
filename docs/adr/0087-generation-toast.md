# ADR-0087 — Generation Jobs use a toast, not a blocking modal

**Status:** accepted  
**Date:** 2026-08-25  
**Issue:** [#1013](https://github.com/Hepteract-Group/marketing-os/issues/1013)  
**Amends:** UX-first “modal on start” for **Generation Jobs in the Studio workspace** (image, video clip, music, speech, reframe, transcribe). [ADR-0041](./0041-music-generation.md), [ADR-0061](./0061-ai-media-surface.md), [ADR-0062](./0062-generated-asset-review.md), [ADR-0074](./0074-subject-tracking-reframe.md) still require a **cannot-miss, reload-safe** indicator — that indicator is now toast + banner, not `aria-modal`.  
**Does not supersede:** Render / export / extract dialogs. Spend-confirm dialogs stay modals.  
**Docs:** [states-and-feedback.md](../ux/states-and-feedback.md)

## Context

Auto-opening a centered Generation dialog blocked the player, slide strip, and chat. Slide-background jobs then enqueue `index` jobs, so the same overlay popped a second time for “Generating index…”. Minimize was still a click. The dialog root is `position: fixed; inset: 0`, so it stole clicks even without a visible backdrop.

Founders generate six backgrounds at once. They need to keep editing.

## Decision

1. **Toast** (top-right of the player column): one card when *new* in-flight (or newly failed) job ids appear. X dismisses it. In-flight auto-hides in about 4 seconds. The card does not use `aria-modal` and does not cover the slide.
2. **Persistent banner** under the player while operator-facing jobs run. One combined line (“Generating 6 slide backgrounds…”), not one banner per job. Survives reload via poll.
3. **`index` jobs** stay on the Media bin “Preparing library…” chip. They do not pulse Studio generation chrome.
4. Failures stay on a banner until Dismiss. The toast for a failure does not auto-hide.

## Consequences

- Render / export / extract keep a minimizable dialog — those jobs occupy the player meaning.
- Local worker-down copy still belongs on the banner, not a toast that vanishes.
