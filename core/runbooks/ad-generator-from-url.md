# Runbook: Ad Generator from URL/PDF

**Purpose:** Turn a product URL or PDF into a parent Studio cut, then fan out platform × messaging ad versions — without hiring an editor for the first pass.
**Cadence:** As needed when launching or refreshing an ad set (typically weekly with content batch).
**Owner:** Founder (marketing operator).
**Time budget:** 15–40 minutes for extract → apply → a small variant set (4–8 cuts); longer if you scrub every version before Approve.
**Automation status:** partially automated — Studio wizard + extract worker + Variant Grid; Approve and Publish remain human steps (ADR-0010 / ADR-0027).

## Inputs

- Active **Product** membership (Studio must know which product you’re cutting for).
- Local dashboard running against Synawood Supabase + Blob (`dashboard/.env.local`).
- Source:
  - **URL** — public marketing page (e.g. example.com), or
  - **PDF** — one-pager / pitch PDF under size/page caps.
- Optional: API keys for a paid reasoner/vision enrich (`AI_GATEWAY_API_KEY`). Extract forms always use a paid Reason model; CI still has a `mock-*` path.
- Contracts (read when behaviour is unclear):
  - [ADR-0027](../../docs/adr/0027-ad-generator-and-variants.md)
  - [UX flow](../../docs/ux/ad-generator-flow.md)
  - [Architecture](../../docs/architecture/ad-generator-and-variants.md)

## Preconditions (local)

1. From repo root: `cd dashboard && npm run dev` → `http://localhost:3000/studio`.
2. Extract jobs need a worker. In Next **development**, Studio usually auto-spawns one after enqueue. If the banner still says the job is stuck:
   - From repo root: `npm run extract:local`
   - Or confirm `STUDIO_EXTRACT_INLINE` is not set to `false` in `.env.local`.
3. `MARKETPLACE_ADAPTERS` stays `false` unless you are deliberately testing Wave 2G stubs (no real stock purchase).

## Steps

### A — First cut from URL or PDF

1. **Open Studio home** (`/studio`). Done = product projects listed (or empty state).
2. Click **New project** → Start from **URL or PDF** (or open an existing blank project → **Ad Generator** chip).
   Done = Ad Generator wizard opens on the source step.
3. **Choose source:** paste a public HTTPS URL **or** upload a PDF, then click **Extract**.
   Done = extract started (or an on-form error if monthly credits cannot cover the run).
4. **Wait for extract.** Keep the modal or minimize it — a **persistent banner** must remain while status is queued/generating.
   Done = wizard moves to **Review brief**, or failure UI with Retry (brief not applied).
5. **Review the brief** (do not skip). Fix:
   - Logo / colours / display name / brand CTA
   - One-liner, benefits, pricing notes
   - Hook candidates and CTA candidates
   - Fields marked “Check this” (low confidence)
   Edits autosave while you stay on Review.
   Done = you’re willing to Apply this brief to the parent cut.
6. Click **Apply to project**. Done = you land on the **parent** project with brand seeded and a first cut; status chip shows `First cut: minimal` (or Director when Wave 2A is available).
7. Optional next: shape the cut with Intent / Scenes / AI Director — [intent-scenes-director.md](./intent-scenes-director.md).
8. Optional: open **Brand Studio** to refine logo/colours further — ready brief stays in sync until Apply has already been used.

### B — Fan out ad versions

1. On the **parent** cut, click **Ad versions** (chip shows a count when versions already exist).
   Done = Variant Grid opens.
2. **Plan:** pick places to publish (e.g. TikTok + IG Reels) and which hooks/CTAs. Soft warn above 12 versions.
   Done = plan shows version count + create £0 + export estimate if you will render.
3. **Create** ad versions (confirm spend only when export/render is included). Done = cells appear grouped by platform; each is its own Studio project under this parent. If the parent has named style branches, cells may show **From {branch}** and filter chips — those tips are **not** Ad versions (see [studio-named-branches.md](./studio-named-branches.md)).
4. From Studio home, parent cards show **N ad versions** — expand the menu to open a child. Or from a child Studio header: **← Main cut** and the version switcher.
5. On a child: **Edit version** (or overrides drawer in the grid) to change opening line / CTA → **Save on this version**.
   Done = only that child updates.
6. If a child wins: **Promote to main cut** and confirm which fields (opening line / call to action). Done = parent **active tip** updates; other parent fields unchanged. Switch the parent Branch chip first if you meant a different tip.

### C — Approve and publish (per cut)

1. Scrub the parent and/or each child in Studio Player.
2. **Approve** each cut you will ship (Review bar). Parent Approve does **not** auto-approve children.
   Done = Final asset exists for that project with attribution (parent / variant / brief ids on children).
3. **Publish** separately (manual in Phase 0–1) — never auto-post on Approve.

## Outputs

| Artifact | Where |
|---|---|
| Extracted brief (ready → applied) | `extracted_briefs` + mirrored on `project.brief` after Apply |
| Parent first cut | Studio project (no `parent_project_id`) |
| Ad versions | Child Studio projects (`parent_project_id` + `variant_spec`) |
| Finals | `final_assets` per approved project |
| Cost events | `cost_events` for extract / export estimates that ran |

## Escalation

| Symptom | What to do |
|---|---|
| Extract stuck on queued/generating | Start `npm run extract:local`; check banner after reload. Do not Apply until ready. |
| Wrong logo after extract | Fix in Review **or** Brand Studio before Apply; after Apply, edit Brand Studio on the project. |
| Typing in Review clears | Ensure you’re on current main; autosave should keep edits — if not, file a P0 with repro. |
| Soft cap / spend modal surprises you | Lower platform × hook × CTA counts; create versions first (£0), export later. |
| Cannot find child versions | Studio home → parent card → versions menu; or parent **Ad versions · N**. |
| Promote would overwrite too much | Only check fields you edited; cancel if unsure. |
| URL blocked / SSRF | Use a public HTTPS host; private/local URLs are rejected by design. |
| PDF rejected | Shrink file or page count; respect size/page caps. |
| Hosted vs local confusion | Never point local Studio at the private example Supabase; use Synawood project only. |

Stop and ask the founder (yourself) before enabling paid marketplace adapters or live ads APIs — those are Wave 2G / non-goals for this epic.

## Smoke checklist (after a Studio change)

Copy-paste for localhost review (from architecture § Local verification):

1. Wizard: URL (e.g. example.com) → extract → edit a low-confidence field → Apply → parent shows brand + hook/CTA.
2. Plan ~4 versions → children linked under parent → open one in Studio and scrub.
3. Approve one child → Final has attribution.
4. Promote CTA/hook from child → parent overlays update.
5. Reload mid-extract: banner recovers from server job status.

## Related commands

```bash
# Dashboard (review port)
npm run dev:review

# Extract worker (if inline spawn is off or stuck)
npm run extract:local

# Ad Generator unit coverage gate
npm run test:ad-generator:coverage
```

Also see named branches (styles inside one cut): [studio-named-branches.md](./studio-named-branches.md).

## Change log

- 2026-08-07 — Branch stamp / filter note + promote-to-active-tip (Wave 2D / #190).
- 2026-08-03 — v1 created for Vision Wave 2B (#161); covers wizard, variants, promote, local workers.
