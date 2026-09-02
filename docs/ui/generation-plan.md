# Generation Plan (UI)

Visual spec. Behaviour: [ux/generation-plan.md](../ux/generation-plan.md). Reuse `dialog-root` / `dialog-panel` from generate/billing. Tokens: [tokens.md](./tokens.md). Confirm spend: [billing.md](./billing.md) §2.

## Modal

Max width ~560px. Eyebrow: **Plan**. Title: **Generation plan**.

### Hierarchy

1. Goal / angle (textarea, short)
2. Tone (select + optional note)
3. Runtime + platform (one row)
4. Scenes: stacked cards — role, description, duration, **Dialogue**, on-screen text
5. Models: one line each (Reason / Pictures / Video) — Frozen video blocks confirm
6. Extra extract URLs (optional list) + checkbox **Re-extract this turn** (default off)
7. **£ total** large tabular; per-scene expand
8. Actions: ghost Discard · secondary Save draft · primary **Confirm spend and generate**

Minimize → banner in `workspace-status-stack` (same as generate): **Plan ready — confirm to generate.** Click reopens modal.

Do not put the £ only on the Send button.

## Fields

Labels: **Dialogue**, **Voiceover** where it is VO. Never **Script**.

Scene cards: 8px padding, 8px gap. Add scene = text button, not a FAB.
