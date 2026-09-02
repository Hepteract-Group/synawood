# Architecture review — Creative Studio / Synawood design

*Senior-architect pass over `docs/` after Supabase + Azure Blob + local-first lock-in. Date: 2026-07-18.*

## Verdict

The design is coherent for a parallel Phase 1 risk track: thin AI SDK harness, generate→assemble, brand binding, Model Profiles, Blob+Supabase, Approve≠Publish, Postiz deferred. Main gaps were **auth**, **local-first**, **explicit Supabase**, and **ops realism** (free-tier, workers, the private example boundary). Those are now documented; remaining items below are tracked as follow-through, not blockers to starting Slice 0–1.

---

## What is solid

- Clear dual-track operating model (funnel vs Studio) with kill rules.
- Studio Project as source of truth; Remotion as assemble/export, not the only media source.
- Brand Paths A/B/C — logo correctness not left to diffusion hope.
- Model Profiles — pick-and-choose without rewriting compositions.
- Cost ledger + estimate-before-generate.
- Marketing skills ≠ engineering skills.
- Persistence split Blob/DB; Postiz as adapter after Approve.

---

## Gaps closed in this pass

| Gap | Mitigation now in docs |
|---|---|
| Postgres host undecided | **Supabase** dedicated project ([storage](./storage-and-persistence.md), ADR-0009) |
| Azure ops story | App SDK + env; **Azure CLI** for bootstrap/debug |
| Deploy-first QA | **Local-first** ([local-first.md](./local-first.md), ADR-0011) |
| Auth / security underspecified | [auth-and-security.md](./auth-and-security.md) |

---

## Remaining gaps and mitigations

### 1. Auth productization (P1 before any shared URL)

**Risk:** Studio API open on a preview deploy → spend + media leak.  
**Mitigation:** Gate all studio routes (v1: single-user Supabase Auth or deployment protection). No anon generation. See auth doc.  
**Guardrail:** Do not enable public Vercel URL for Studio until auth works locally.

### 2. Remotion encode on Vercel (P1 before prod export)

**Risk:** Serverless timeouts; Remotion needs Chromium/ffmpeg-class resources.  
**Mitigation:** Local encode worker first; for Vercel use a **dedicated render path** (long-running route, separate worker service, or queue + VM) — decide in implementation ADR when Slice 1 lands. Do not assume `renderMedia` fits a default serverless function.  
**Guardrail:** Local `render_export` must work before cloud encode is promised.

### 3. Supabase free-plan limits (P2 watch)

**Risk:** DB size, egress, or paused project breaks Studio.  
**Mitigation:** Dev vs prod projects optional; purge `killed` assets; monitor. Upgrade when weekly shipping is real.  
**Guardrail:** Never point Synawood at the private example Supabase.

### 4. Azure cost / blob sprawl (P2)

**Risk:** Orphan generated clips accumulate.  
**Mitigation:** Lifecycle rule on `generated/` prefix (e.g. delete unreferenced after N days); `final_assets` retained longer.  
**Guardrail:** Generation Job always writes `blob_key` + DB row together (transactional intent: write blob then row; compensating delete on failure).

### 5. Dual write git + DB drift (P2)

**Risk:** `content/` markdown and DB disagree.  
**Mitigation:** DB is system of record for media; git pointers are best-effort. Week board reads DB.  
**Guardrail:** Don’t build two editors for the same Final asset.

### 6. Model/provider churn & experimental video API (P1 awareness)

**Risk:** `experimental_generateVideo` changes; Gateway model ids rename.  
**Mitigation:** Model Profiles isolate churn; adapter tests with mocks; pin SDK major.  
**Guardrail:** One integration test per role with mock; smoke with real keys only when asked (cost).

### 7. Founder video PII (P2)

**Risk:** Talking-head footage is personal data in Blob.  
**Mitigation:** Private container, signed URLs, access only for authenticated operator. Retention note in runbook later.  
**Guardrail:** No public CDN for uploads by default.

### 8. Prompt injection via Brief/chat (P2 light)

**Risk:** Malicious/pasted text tries to exfiltrate tools or skip Approve.  
**Mitigation:** Allowlisted tools; no shell; Approve human-only; don’t honor “ignore brand kit” for Path C.  
**Guardrail:** Path C chrome always applied on ad recipes regardless of chat.

### 9. Observability (P2)

**Risk:** Failed jobs invisible.  
**Mitigation:** Job status in DB + Studio UI; later: simple error log table or Vercel logs.  
**Guardrail:** Failed Generation/Render Jobs surface plain English in UI ([ux/states](../ux/states-and-feedback.md)).

### 10. MCP timing (defer)

**Risk:** Building MCP before tools stable wastes effort.  
**Mitigation:** Already deferred to after in-process tools ([mcp-surface.md](./mcp-surface.md)). Keep.

### 11. Multi-product tenancy (defer)

**Risk:** Premature abstraction.  
**Mitigation:** `productId` on rows from day one; single product UI OK.  
**Guardrail:** Don’t build org/teams until a second product exists.

### 12. Creative Studio vs Phase 1 timebox (operational)

**Risk:** Studio eats funnel work.  
**Mitigation:** ADR-0004 + kill rules; 20–30% maker time. Enforce socially, not in code.

---

## Guardrails (lean — not bureaucratic)

1. Local review before Vercel for Studio/dashboard work.  
2. Dedicated Supabase — never the private example project.  
3. Private Blob + short-lived signed URLs.  
4. Service role / Azure keys server-only.  
5. Allowlisted Studio Tools; no shell.  
6. Approve ≠ Publish; no auto-post.  
7. Brand Path C on Final ad exports.  
8. Cost estimate + caps before expensive video gen.  
9. Ask before enabling new paid model spend.  
10. Functional TypeScript; ADRs for harness/render lock-ins.

Avoid: mandatory multi-reviewer gates, heavy compliance frameworks, CapCut feature checklists as done criteria.

---

## Security summary

| Area | Measure |
|---|---|
| Auth | Operator-only gate on Studio + APIs |
| Secrets | `.env.local` / Vercel; `.env.example` names only |
| Blob | Private; signed URLs; dev/prod split |
| DB | RLS before browser anon; service role server-only |
| AI keys | Server-only; budget caps |
| Agent | Tool allowlist; human Approve/Publish |

---

## Suggested implementation order (unchanged spirit, storage clarified)

0. Docs/skeleton (done-ish) + Supabase project + Blob container via `az`  
1. Local Next app + Supabase schema + Blob upload/download smoke  
2. Studio Project + Remotion preview/export **locally**  
3. Agent tool loop + one Generator (image) behind profile  
4. Video clip gen + cost caps  
5. Approve → final_assets + manual publish record  
6. Vercel deploy after local sign-off  
7. Postiz adapter — Plan 29 / [ADR-0063](../adr/0063-postiz-in-scope.md) (un-deferred 2026-08-22)  

---

## Missed-nice-to-haves (explicitly out until needed)

- Full undo stack / OT collaboration  
- Asset DAM UI beyond Studio library  
- Automated brand vision QA of logos  
- Multi-region Blob  
- Customer-facing “create ads for your brand” SaaS  

---

## Doc index for this review

| Topic | Doc |
|---|---|
| Supabase + Blob | [storage-and-persistence.md](./storage-and-persistence.md) |
| Local-first | [local-first.md](./local-first.md) |
| Auth/security | [auth-and-security.md](./auth-and-security.md) |
| Distribution | [distribution-and-postiz.md](./distribution-and-postiz.md) |
| ADRs | 0009, 0010, 0011 |
