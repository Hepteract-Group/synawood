# Creative factory layout

Campaign pack detail (`/campaigns/[id]`) is a **factory grid**, not the NLE Studio shell.

```
┌────────────────────────────────────────────────────────────┐
│ Pack title · brief · Add / Regenerate / ReviewBar          │
├──────────┬──────────┬──────────┬──────────┐
│ Card     │ Card     │ Card     │ …        │
│ preview  │ preview  │ preview  │          │
│ headline │ headline │ headline │          │
└──────────┴──────────┴──────────┴──────────┘
```

- Selection checkboxes drive Regenerate selected and Approve selected.
- Headline edits are Path C props only (no image spend).
- Progress uses a persistent banner while create/generate/export runs.
