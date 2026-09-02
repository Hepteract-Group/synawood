# Content pipeline UX

Dashboard **Work board** (`/content`) is a founder project-management surface — not a file browser.

## Views

1. **Week** — calendar grid (Mon–Sun) with ← / → navigation (calendar only; does not filter the Board).
2. **Month** — full-month calendar with ← / → month navigation.
3. **Board** — product kanban of **all tasks** (no week arrows):
   - **Planned** — draft / not started in Studio
   - **In progress** — Studio cut, needs review, or Final ready (not yet posted)
   - **Done** — posted (or discarded)

## Card & detail

- Cards show title, channel, status, priority, due date, assignee, labels, comment count, and **posted links on the card** (not a separate board section).
- Open a card for CRUD: title, notes, status, priority, due/planned dates, labels, assignee, comments, delete.
- Paste live post URLs on the card (moves to Done). Done requires a posted URL — drag alone is not enough.
- After Approve: **Schedule** / **Post now** for organic Postiz channels ([schedule-and-publish.md](./schedule-and-publish.md)). Paste URL remains for everything else.
- Link into Studio (open existing cut or start a new one). Kanban columns follow pipeline (Final/posted) with optional Planned/In progress overrides.

## Must not require

- Knowing git paths or `products/…/content/drafts/` week folders
- Running CLI to Approve
