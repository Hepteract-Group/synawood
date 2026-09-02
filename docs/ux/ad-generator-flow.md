# Ad Generator — founder flow

> UX for Vision Wave 2B. Architecture: [ad-generator-and-variants.md](../architecture/ad-generator-and-variants.md). ADR: [0027](../adr/0027-ad-generator-and-variants.md).

## What the founder sees

One job: **turn a URL or PDF into testable ad cuts**, then fan out variants without rebuilding the timeline by hand.

Surfaces:

1. **Ad Generator wizard** (entry from Studio home or empty project) — source → extract → review brief → apply.
2. **Variant Grid** (on parent project) — matrix of children, preview, overrides, promote.
3. Existing **Studio editor** — open any parent/child as a normal project (chat + timeline + player).

## Flow F — URL/PDF → first cut → variants

### F1 — Start

1. Studio home → **New project** → Start from **URL or PDF** (or project menu → Ad Generator).
2. Choose source: paste URL **or** upload PDF. Pick a Reason model (No LLM is not on this form).
3. Click **Extract**. A small credit charge is expected; there is no spend confirm. Extract fails on the form only when monthly generator credits cannot cover the run. If a worker is required locally, a banner says so (same pattern as render/generate).

### F2 — Extract

1. Modal: “Extracting brief…” (minimize allowed).
2. Persistent banner while job `queued`/`generating`.
3. On failure: modal + banner with retry; brief not applied.
4. On success: wizard step **Review brief**.

### F3 — Review brief (cannot miss)

Show structured fields, not a wall of HTML:

- Brand: colors, logo preview, name, CTA
- Product: one-liner, benefits
- Messaging: hook list, CTA list
- **Confidence:** low-confidence fields highlighted (edit in place)

Primary CTA: **Apply to project**. Secondary: Discard / Re-extract.

### F4 — Apply

1. Modal while apply runs.
2. Land in Studio on the **parent** project with brand set and first cut (Director when available; otherwise minimal hook + end card — status chip: “First cut: minimal” vs “First cut: Director”).
3. Founder can open Brand Studio to refine (ADR-0025 unchanged).

### F5 — Plan variants

1. From parent: **Variants** opens Variant Grid empty state → **Plan variants**.
2. Pick platforms + which hooks/CTAs (defaults: top 2 hooks × top 2 CTAs × TikTok + IG Reels).
3. Show count + estimated £ → Confirm.
4. Soft warn above 12 variants.

### F6 — Grid

- Cells = child projects (platform · hook · CTA).
- Click cell → open child in Studio **or** inline preview player when render ready.
- Overrides drawer: edit hook/CTA text for that cell → saves on child only.
- **Promote to parent** confirms which fields move back.
- Approve lives on each child (existing Review bar); parent does not bulk-Approve silently.

### F7 — Resume / reload

All state is server-backed (brief row, jobs, parent/child projects). Reload recovers banners from job status; never rely on client-only flags.

## Copy principles

- Say “brief”, “variant”, “parent cut” — not internal table names.
- Never show tool_ids or UUIDs in primary UI (Activity/trace may show summaries).
- Low confidence: “We weren’t sure about this — check before applying.”

## Non-goals (UX)

- Spreadsheet-only editing of variants without opening Studio.
- Auto-posting variants to ads managers.
- Hiding extract cost until after the job finishes.
