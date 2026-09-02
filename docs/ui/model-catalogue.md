# Model catalogue (UI)

Visual spec. Behaviour: [ux/model-catalogue.md](../ux/model-catalogue.md). Tokens: [tokens.md](./tokens.md). Components: [components.md](./components.md).

## Route

`/settings/models` (or Settings → Models). Also a panel reached from **Model choices** in the chat session row (same content, dialog, max-width ~640px).

Not a Studio competing column next to the player.

## Page layout

1. Title: **Models**
2. Intro one line: which models we support and when to use them.
3. Three sections: **Reason** / **Pictures** / **Video** (plain English, not “reasoner”).
4. Rows: 8px grid, 12px between sections.

### Row

| Element | Spec |
|---|---|
| Name | body, semibold — picker label |
| Use when | muted, one line |
| Meta | caps + £, tabular nums |
| Badge | Live = default chip; Frozen = danger/warning chip **Frozen** + full sentence under the row |

Frozen row: 50% opacity **plus** the sentence. Control disabled. Do not rely on opacity alone.

Session row: text button **Model choices** — not a 10px glyph, not three links under the pickers.

Motion: none required. Badge change: 150ms opacity ( [motion.md](./motion.md) ).
