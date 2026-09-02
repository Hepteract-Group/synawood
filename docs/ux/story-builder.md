# Story Builder (Media bin mode)

Backs [asset-intelligence.md](../architecture/asset-intelligence.md) and ADR-0032. Sits inside Studio Media bin (ADR-0016) — not a separate app.

## Where it lives

```
+------------------------------------------------------------------+
| Studio header                                                    |
+-----------+-----------------------------+--------------------------+
| Media bin |        Player + transport   |  Chat                    |
|  Library  |                             |                          |
|  Story ★  |                             |                          |
+-----------+-----------------------------+--------------------------+
| Timeline                                                           |
+------------------------------------------------------------------+
```

- **Library** — today’s flat / filtered asset list (ADR-0015 place + reference).
- **Story Builder** — search box, example chips, filmstrip results (shot thumbnail + caption + Place / Reference / Basket), preview modal with a horizontal shot strip. Place on a shot hit sends `startMs`/`endMs` so the timeline gets the Shot trim, not the whole file.

## States

### Empty index

Upload CTA + copy: “Index runs when files land. Search turns on when assets are ready.” Persistent chip if jobs queued.

### Searching

Query + optional tags + kind filters. Results: thumbnail, caption line, top tags. Click result → preview modal (keyframes / shot list). Actions: **Place on timeline**, **Reference in chat**, **Add to Director basket**. Basket panel below results; **Use in Director** inserts ordered `@asset` picks into chat.

### Indexing in flight

Chip in bin header / workspace: “Indexing 2 of 5…” — survives reload (poll server). Failed assets show plain reason + Retry.

### Appearance search blocked

Copy on the existing chip: **Appearance search needs indexing — Retry**. Not a console log. Retry enqueues index for the blocked asset.

## Guardrails

- Never silent paid caption/embed — estimate/confirm path when spend > 0 (ADR-0018).
- Child variant projects share parent product index (product scope).
- Branches (ADR-0030) do not fork the asset index — media is product-level.

## Related

- Operator: [studio-asset-intelligence.md](../../core/runbooks/studio-asset-intelligence.md). Named branches: [studio-named-branches.md](../../core/runbooks/studio-named-branches.md).
- Suggestions UX: [contextual-clip-panel.md](./contextual-clip-panel.md).
