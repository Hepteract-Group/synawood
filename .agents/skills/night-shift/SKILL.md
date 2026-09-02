---
name: night-shift
description: >-
  Runs an unattended overnight GitHub-issue shift: intake a disk queue,
  implement and merge ready-for-agent tickets serially onto main, then write
  a morning QA handoff. Use when the user says night shift, night-shift,
  execute the night-shift queue, or asks for a morning handoff of overnight work.
---

# Night shift

Unattended loop over the Synawood board. The founder is asleep. Treat every founder question as a **skip**, not a wait.

Read this skill fully before acting. Ticket implementation still follows root `AGENTS.md` — this skill only orchestrates **intake**, **execute**, and **handoff**.

Disk is the source of truth. Chat context will compact; `docs/local/night_shift/queue.md` will not.

Artifact templates: [ARTIFACTS.md](ARTIFACTS.md).

## Defaults

| Knob | Default | Override |
|---|---|---|
| Execute cap | 4 tickets | User says `Max N tickets` |
| Horizon | 12 eligible | — |
| Merge | squash to `main` after green CI + higher-model review | — |
| Runtime | local laptop, assumed awake | — |
| Build-in-public | Skip/Hold line in the handoff only | — |

## Branch

The user names a phase. If they name none, run **intake** then stop (do not silently execute).

| User says | Phase |
|---|---|
| intake / discovery / queue | **Intake** |
| execute / implement / take the queue | **Execute** |
| handoff / reflection / morning | **Handoff** |

---

## Intake

**Done when** `docs/local/night_shift/queue.md` exists, lists eligible tickets in board order, lists every skip with a reason, and records the execute cap.

1. Read the Synawood project board (`gh project 5 --owner Hepteract-Group`) and open issues. Pick **P0 before P1 before P2**.
2. Eligible only if **all** of:
   - `ready-for-agent`
   - `type:task` (or a `type:feature` that already has an agent brief)
   - not an epic
   - not blocked
   - not `needs-info` / `ready-for-human`
3. **Skip** (comment on the issue, apply `needs-info` or `ready-for-human`, do not start it) when:
   - no agent brief, or acceptance criteria are vague
   - a required ADR / system-design / UX / UI doc is missing
   - the work spends money (model APIs, ads)
   - the work is architecture / harness / a founder product call
4. Write `queue.md` from [ARTIFACTS.md](ARTIFACTS.md). Eligible list is the **horizon** (up to 12). Execute will take the first **cap** unfinished rows.
5. List the skills each eligible ticket needs (`/tdd`, `/code-review`, `/implement`, …). Do not start implementation.

Do not write ADRs or design docs on this shift. Missing docs → skip.

---

## Execute

**Done when** every ticket taken this wave is merged, skipped, or a stop condition fired; `queue.md` is updated; working tree is clean on `main`.

**Dev server:** `npm run dev` is Turbopack. After each merge (and whenever Next logs `approaching the used memory threshold`), run `npm run dev:health`. Red → recycle: stop the dashboard process, `rm -rf dashboard/.next/cache/webpack`, start `npm run dev` again. Do not keep a webpack `next-dev` process overnight so the founder can “still have the server.” A sick 12-hour process is the bug.

1. Read `queue.md`. If it is missing, run **Intake** first.
2. Take the next unfinished eligible row, up to the cap. One ticket at a time.
3. For each ticket, follow `AGENTS.md` end to end: intent comment, branch from fresh `main`, implement, format, compile, higher-model review, **fix every review finding (blocking and non-blocking) without asking**, PR, wait for required CI, **squash-merge to `main`**, Status → Done. Do not stop after the review report.
4. After each merge: `git checkout main && git pull`. Start the next ticket from that `main`.
5. Update `queue.md` as you go (`[x]` + PR number, or move to Skipped).

**Skip instead of asking.** Comment what you needed, label `needs-info` or `ready-for-human`, continue to the next row.

**Review is not a pause.** After `/code-review`, fix every finding (blocking and non-blocking), re-run the review once, then open/update the PR. Do not wait for a founder message that says "fix those."

**CI:** watch checks to completion. One fix cycle is allowed. Same ticket red after that → leave the PR open, skip, continue.

**Stop the wave** when any of these is true:

- execute cap reached
- no eligible rows left
- user-stated stop time reached
- working tree dirty after a ticket and you cannot clean it
- you would have to ask the founder to proceed

Do not start a fifth ticket because “there is time.” Cap is the cap. Queue another execute message for another wave.

---

## Handoff

**Done when** `docs/local/night_shift/handoff-YYYY-MM-DD.md` exists and a founder can QA every merged ticket from that file alone.

1. Read `queue.md` and the PRs merged this shift (all waves that date).
2. Write the handoff from [ARTIFACTS.md](ARTIFACTS.md).
3. QA walkthrough: group checks **by page/route**, not by ticket. If two tickets show on one screen, one step. Copy-pasteable localhost commands + exact URLs.
4. Configs the founder must have (env vars, workers, flags) in one list at the top.
5. Append lessons to `docs/local/night_shift/lessons.md` (create if missing). What broke the loop, what to change in this skill, what to triage tomorrow.
6. If you find a defect in merged work: fix it now only when it is in-scope, testable, and still fits the shift. Otherwise file an issue and list it under Filed.

Do not draft X posts. One Skip/Hold line in the handoff is enough.
