# Responsive layouts

Operator console first (desktop). Phone and tablet must still be usable — we adapt the chrome, we do not ship a second product. Epic [#818](https://github.com/Hepteract-Group/marketing-os/issues/818).

## Breakpoints (keep CSS in sync)

| Token name | Width | Use |
|---|---|---|
| Phone | `max-width: 640px` | Tight padding, single column, 44px taps |
| Shell | `max-width: 760px` | Synawood sidebar becomes a Menu sheet (`#819`) |
| Public stack | `max-width: 900px` | Landing hero becomes one column (`#820`) |
| Studio stack | `max-width: 1100px` | Studio panes stack (`#828`) |
| Comfort | `min-width: 1440px` | Default desktop composition |

Media queries cannot read CSS variables. These pixel values are the contract.

## Rules

1. **No horizontal page scroll.** Overflow lives inside a named region (table, filmstrip, timeline). Use `.mos-table-scroll` for wide tables.
2. **Modals fit the viewport.** Panel `max-height: 90dvh`; scroll inside the panel. Safe-area padding on the overlay.
3. **Touch.** Primary actions ≥44px on phone. Do not rely on hover.
4. **Nav.** Under 760px the 11 Synawood destinations are a labeled Menu, not a row of unlabeled icons.
5. **Studio** stays a full-viewport editor on desktop (ADR-0016). On phone it may stack or sheet; do not crush three columns.
6. **Public / auth (`#820`).** Landing stacks at **900px** (copy first, then the Studio mock). Waitlist and auth inputs are 16px / 44px so iOS does not zoom. Auth panels (`/login`, `/signup`, `/invite`, `/onboarding`, `/access-denied`) scroll inside `90dvh`.
7. **Home / Products / Usage (`#821`).** Funnel is one column under 640px. Spend tables scroll inside `.mos-table-scroll`. Product cards drop the square aspect on phone.
8. **Campaigns (`#822`).** Composer aspect tabs and count stepper are 44px. Pack creative grid is one column under 640px.
9. **Work board (`#823`).** Week calendar is one column under 700px. Task modal (`.work-detail-panel`) scrolls inside 90dvh. Toolbar and slot actions are 44px through 900px.
10. **Goals (`#824`).** Composer fields and Propose/Pause/Kill are 44px. Action rows stack on phone.
11. **Insights / Approvals / AI Media (`#825`).** `.packs-tabs` wrap. Inbox and job links are 44px.
12. **Settings (`#826`).** Eight-tab local nav wraps. Members/Outcomes/Brand fields and header actions are 44px / 16px.
13. **Studio home (`#827`).** Project cards drop the square aspect on phone. New/Rename dialogs use 16px / 44px fields.
14. **Studio media bin / Story (`#829`).** Category tabs, Library | Story, search, tags, ingest, and retries are 44px through the 1100px stack. Story preview and Add from URL stay inside 90dvh. Phone library is two columns.
15. **Studio overlays / wizards (`#830`).** Brand, Music, Voice, overlay bins, Ad Generator, Director preview, extract bar, confirm/job dialogs, and the clip drawer stay inside 90dvh. Primary controls are 44px through the 1100px stack.

## Check sizes

Phone **390×844**, tablet **768×1024**, desktop **1440×900**.

## Slices

Work the GitHub tasks in order: [#819](https://github.com/Hepteract-Group/marketing-os/issues/819) → [#830](https://github.com/Hepteract-Group/marketing-os/issues/830).
