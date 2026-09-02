# Runbook: Intent, Scenes, and AI Director

**Purpose:** Shape a Studio cut with Intent + Scenes, preview a Director rebuild, then tighten individual clips with the Suggestions drawer — without hiring an editor for a standard ≤60s short-form edit.
**Cadence:** As needed when finishing a talking-head / first-cut ad (often after Ad Generator Apply, or when scrubbing an existing project).
**Owner:** Founder (marketing operator).
**Time budget:** 10–25 minutes for Intent → Infer scenes → Preview Director → Apply → 1–2 suggestion applies.
**Automation status:** partially automated — Studio Intent rail, Scene strip, Director Preview modal, and Suggestions drawer; Approve / Export / Publish remain human (ADR-0010).

## Inputs

- Local dashboard on Synawood Supabase + Blob (`dashboard/.env.local`).
- A Studio project with at least one video/image clip on the timeline (Ad Generator parent cut or an upload).
- Optional: paid reasoner via `AI_GATEWAY_API_KEY`. Without keys / with **No LLM**, Director + suggestions use the **heuristic** path (£0) — still reviewable.
- Contracts (when behaviour is unclear):
  - [ADR-0026](../../docs/adr/0026-intent-and-scene-tree.md) Intent + Scenes
  - [ADR-0029](../../docs/adr/0029-ai-director-and-contextual-suggestions.md) Director + suggestions
  - [ADR-0031](../../docs/adr/0031-multi-agent-as-skills.md) skill packs (not multi-agent runtime)
  - Architecture: [intent-and-scenes](../../docs/architecture/intent-and-scenes.md), [ai-director](../../docs/architecture/ai-director.md), [contextual-clip-suggestions](../../docs/architecture/contextual-clip-suggestions.md)
  - UX: [intent-panel](../../docs/ux/intent-panel.md), [contextual-clip-panel](../../docs/ux/contextual-clip-panel.md)

## Preconditions (local)

1. From repo root: `cd dashboard && npm run dev` → open a project under `http://localhost:3000/studio/<id>`.
2. Confirm you are **not** pointing at the private example’s Supabase project (see `.cursor/rules/env-and-deploy.mdc`).
3. If Director Preview stays empty on a paid profile, check the reasoner key — or switch reasoner to **No LLM** for a deterministic heuristic draft.

## Steps

### A — Set Intent

1. Open the **Intent** rail / panel on the project. Done = panel shows goal, platform, emotion, length, CTA, etc.
2. Fill the fields that matter for this cut (at least platform + emotion or CTA). Edits **autosave**; the Intent chip updates live.
   Done = chip summarizes the intent (not “Not set yet”).
3. Changing structural fields (e.g. emotion) may show a **rebuild banner** offering Preview — do **not** expect the timeline to mutate on its own (ADR-0018 / ADR-0026).

### B — Infer or edit Scenes

1. On the **Scene strip**, click **Infer scenes** (or Add scene manually).
   Done = proposed scene list appears for review (roles/labels); apply is explicit — not a silent rewrite.
2. Apply the scene plan. Assign clips to scenes if Infer left gaps.
   Done = strip shows scenes; timeline clips map into roles (Hook / Problem / …).

### C — AI Director preview → Apply

1. Click **Preview changes** (Director) from the Intent rail / rebuild banner. Pick a vibe if prompted (`energetic`, `urgent`, … or free text).
   Done = **Director Preview** modal opens with a checklist of proposed edits + cost (mock / heuristic = £0).
2. Review skipped ideas (“Couldn’t apply…”) — expand if closed; reasons should say *why* (e.g. missing field).
3. Cherry-pick: uncheck edits you don’t want. Optionally **Refine** with a short note and regenerate.
4. Click **Apply** to commit onto the **current** tip, **or** **Save as branch** to apply onto a new named tip (Wave 2D — see [studio-named-branches.md](./studio-named-branches.md)). Done = one revision bump; timeline updates; rebuild prompt clears; a Director pill may remain if a draft still exists.
5. **Reject** discards the draft without mutating the cut.
6. Reload the page. Done = if a draft plan still exists, the persistent Director pill remains (server state, not a client-only flag).

### D — Contextual suggestions on a clip

1. Select a **single** clip on the Video track. Done = **Suggestions** drawer opens (Selected clip).
2. Review free suggestions (heuristics). Paid / generator rows stay unchecked until you confirm spend.
3. Apply one suggestion or Apply selected. Done = timeline updates; no-op ideas (e.g. Pack when already packed) must not stay as false Apply actions.
4. Esc / Close hides the drawer; selecting another clip refreshes suggestions for that clip.

## Outputs

- Project with Intent + Scenes populated.
- Optional applied DirectorPlan (`applied` / `rejected` / cleared draft).
- Tighter clip timings / overlays from Suggestions.
- Ready for scrub → Approve → Export (existing Studio pipeline).

## Escalation

| Symptom | What to do |
|---|---|
| Preview shows 0 applyable edits | Expand skipped reasons; try vibe `urgent`/`energetic` with CTA set; or switch to No LLM heuristic. File Director allowlist gaps as a Studio issue if types are wrong. |
| Suggestions drawer empty | Ensure a Video-track clip is selected; Refresh; packable edits only appear when gaps exist. |
| Intent save “updated elsewhere” | Reload the project, then edit again (revision conflict). |
| Director pill says stale | Project revision moved — Preview again before Apply. |
| Real reasoner invents ids | Prefer No LLM; report with project id + style — prompt contract should forbid invented clip/overlay ids. |

Stop and ask the founder before enabling paid generators inside Director plans or raising monthly spend caps.

## Related

- Named style branches (Funny / Luxury inside one cut): [studio-named-branches.md](./studio-named-branches.md)
- Ad Generator first cut (feeds this runbook): [ad-generator-from-url.md](./ad-generator-from-url.md)
- Weekly content batch (when this cut becomes a scheduled post): [weekly-founder-content-batch.md](./weekly-founder-content-batch.md)

## Change log

- 2026-08-07 — Link Director Save-as-branch + named-branches runbook (Wave 2D / #190).
- 2026-08-05 — Initial Wave 2A runbook (plan 08 / #147).
