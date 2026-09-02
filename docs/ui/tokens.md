# Design tokens (direction)

Define CSS variables on the dashboard shell before painting screens:

| Token role | Guidance |
|---|---|
| `--sw-bg` / `--sw-surface` | Layered neutrals; avoid flat pure white-only and pure black-only |
| `--sw-text` / `--sw-muted` | High readability |
| `--sw-accent` | Single accent for primary actions — **not** default purple-indigo AI cliché |
| `--sw-danger` | Kill / errors |
| `--sw-ok` | Approved / healthy |
| `--sw-font-sans` / `--sw-font-mono` | Expressive but operable; load via `next/font` |

Customer Brand kit colors belong in **compositions/exports**, referenced from that Organization’s brand library, not blindly copied onto every dashboard chrome element.
