# Artefacts pane (UX)

A short tree of **project artefacts**, not a Cursor repo. Contract: [ADR-0086](../adr/0086-generation-plan-and-artefacts.md). Visual: [ui/artefacts-pane.md](../ui/artefacts-pane.md). Skills policy: [ADR-0080](../adr/0080-installable-studio-skills.md).

## What they see

A pane (Studio, collapsible like Media / Chat) listing:

1. **Generation Plan** — opens the plan panel; shows status (draft / ready / applied).
2. **Skills** — installed + first-party names. Click = read-only markdown. Enable/disable stays Settings.
3. Optional **Brand** excerpts already on the project (read-only).

No New file. No terminal. No upload of `.js` / `.sh`.

## Rules

- Looks like a file tree; **is** a view of Zod + skill markdown we already store.
- Agent cannot write arbitrary paths.
- Markdown preview: sanitised. No HTML execute.
- Mobile: collapsed by default; plan modal still works from chat.

## Non-goals

- Writable filesystem.
- Per-project skill install in v1 (ADR-0080).
- Pack `scripts/` on hosted SaaS.
