# Night-shift artifacts

All paths under `docs/local/night_shift/` (gitignored). Do not commit them.

## `queue.md`

Rewrite the whole file on intake. On execute, only update checkboxes, PR numbers, and the Skipped / Done sections.

```markdown
# Night shift queue

Updated: <ISO local>
Wave: <N>
Cap: <N>
Stop at: <HH:MM local | none>

## Eligible (board order)

- [ ] #<n> <title> — skills: <list> — notes: <one line>
- [ ] #<n> <title> — skills: <list> — notes: <one line>

## Skipped

- #<n> <title> — <reason> — label: needs-info | ready-for-human

## Done this shift

- #<n> merged <PR url>
```

Horizon is up to 12 eligible rows. Execute takes unfinished rows from the top, up to Cap.

## `handoff-YYYY-MM-DD.md`

One file per calendar date. Later waves **append** (do not overwrite).

```markdown
# Night shift handoff — YYYY-MM-DD

## Configs before you start

- `npm run dev` (Turbopack) — expected: compiles; `npm run dev:health` exits 0 on a warm server
- Worker / env / flag the founder must have, or "none"

## Merged

- #<n> <title> — <PR url> — squash to main `<sha>`

## Open / skipped

- #<n> — <why> — <issue url or PR url>

## Filed

- #<n> <title> — <why now>

## Morning walkthrough

Group by URL. Each step: go here, click this, you should see that.

### http://localhost:3000/<route>
1. …
2. Covers #<n>, #<n>

### http://localhost:3000/<other>
1. …

## Build-in-public

Skip/Hold — overnight; no drafts.

## Lessons (also appended to lessons.md)

- …
```

## `lessons.md`

Append-only. One dated heading per shift.

```markdown
## YYYY-MM-DD

- <what broke or slowed the loop>
- <skill change if any>
```
