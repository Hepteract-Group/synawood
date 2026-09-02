# ADR-0027 — Ad Generator: ExtractedBrief + variant matrix

**Status:** accepted  
**Date:** 2026-08-02  
**Wave:** Vision 2B · Plan index **09** · Epic [#148](https://github.com/Hepteract-Group/marketing-os/issues/148)  
**Related:** ADR-0001 (harness), ADR-0003 (project JSON), ADR-0006 (brand-bound generate), ADR-0010 (publish after approve), ADR-0015 (asset recall; deferred PiP remains separate), ADR-0018 (trust/QC), ADR-0025 (per-project brand), ADR-0028 (extract vision enrichment)  
**Does not supersede:** Wave 2A Intent/Director ADRs when they land — this ADR *consumes* Director when available.  
**Amended by:** [ADR-0028](./0028-extract-vision-enrichment.md) for extract screenshot + reasoner/vision soft-fail (brief/variant decisions below unchanged). [ADR-0089](./0089-product-extracts.md) for Product-scoped Extracts (many public-page stills; brief apply is unchanged).

## Context

Founders need a path from a **product URL or PDF** to a **first-cut Studio Project**, then a **matrix of platform × hook × CTA variants**, without hand-authoring a Brand Kit for every new product or manually forking timelines.

Pomelli’s bar is `URL → Business DNA → creatives`. Synawood already has Brand Studio, generators, Remotion assembly, and Approve — but no first-class **extract → brief → fan-out** contract. Epic #148 children reference this ADR and plan 09; neither existed in-repo until now.

Constraints:

- One Studio Project pipeline (tools + `expectedRevision`); variants must not invent a parallel editor.
- Generators stay brand-bound (ADR-0006 / 0025).
- Raw generator MP4 is never the Final asset (ADR-0002 / generators.md).
- Paid marketplace billing and live paid-ads APIs stay deferred.

## Decision

### 1. ExtractedBrief is a first-class domain object

`ExtractedBrief` is a versioned Zod schema (not free-form chat text). It is the structured output of URL/PDF extraction and the input to `apply_brief`.

Minimum fields (normative; exact keys in `core/creative` schema):

| Group | Contents |
|---|---|
| **source** | `kind: url \| pdf`, `uri` or blob ref, `fetchedAt`, `title` |
| **brandCandidates** | primary/accent colors, logo asset candidate(s), font hints, display name |
| **product** | name, one-liner, benefits[], pricing notes, social proof snippets |
| **messaging** | hookCandidates[], ctaCandidates[], audience hints, tone |
| **confidence** | per-field or overall 0–1; low-confidence fields must surface in UI |
| **raw** | optional truncated extract text / HTML digest for debug (not shown as truth) |

Persistence:

- Table `extracted_briefs` (`id`, `product_id`, `project_id` nullable until applied, `brief_json`, `status`, `source_*`, timestamps, cost linkage).
- Optionally mirrored onto `project.brief` after apply for agent context (same JSON shape).

Extraction is a **Generation Job** with role **`extract`** (extend `generation_jobs.role` CHECK). Reuse enqueue / modal / persistent-banner UX (ADR-0018 / ux states). Spend estimate before run.

### 2. Variants are child Studio Projects, not a shadow timeline

A **parent** project holds the canonical first cut. Each **variant** is a **child** `studio_projects` row:

- `parent_project_id` (nullable FK) on `studio_projects`
- `variant_spec` JSONB: `{ platform, hookId, ctaId, aspect, label }`
- Child `project_json` is a full Studio Project (editable in Studio)
- **Asset sharing:** child `assets[]` may reference the **same** `blob_key` / asset ids copied from parent when unchanged; new generates get new assets. Do **not** deep-copy blobs on fan-out.
- Overriding copy/layout edits live only on the child JSON (promote copies selected fields back to parent — #158)

This satisfies “fan out without duplicating the parent”: the parent remains one project; children are linked forks with shared media bytes, not N unrelated uploads.

**Rejected:** storing only a matrix of override diffs without openable projects (founder cannot scrub/Approve a variant as a real cut). **Rejected:** one project with N parallel clip trees (breaks duration, Approve, and Remotion binding).

### 3. Platforms and matrix axes

Normative axes for v1:

| Axis | Allowed values (v1) |
|---|---|
| **platform** | `tiktok`, `ig_reels`, `yt_shorts`, `meta_feed` |
| **hook** | index into `brief.messaging.hookCandidates` (or override string) |
| **cta** | index into `brief.messaging.ctaCandidates` (or override / `brand.defaultCta`) |
| **aspect** | derived from platform default (`9:16` shorts/reels/tiktok; `1:1` or `4:5` meta_feed) unless overridden |

`plan_variants` builds a **VariantPlan** (list of `variant_spec` + estimated cost). `render_variants` creates child projects + enqueues renders. Caps: soft default max **12** variants per plan unless founder confirms spend; hard product budget still applies.

### 4. `apply_brief` and Director

**Target path (preferred):**

```
ExtractedBrief → apply_brief → project.brand + Intent/Scenes → direct_project (Wave 2A) → first cut
```

**Interim path (allowed until Wave 2A `#139` ships):**

`apply_brief` with `firstCutMode: 'minimal'`:

1. Write `project.brand` from `brandCandidates` (Path A stills if logo/stills extracted; else colors + CTA only).
2. Seed Path C overlays: hook title from top hook candidate; end card from top CTA.
3. Optionally enqueue one brand-bound `generate_image` hero still and `add_clip` (estimate-before-generate).
4. Do **not** invent a fake DirectorPlan.

Tool / UI must surface which mode ran. When `#139` exists, default flips to `'director'`.

### 5. Approve and attribution

- Each child Approves independently → own `final_assets` row.
- Parent Approve does **not** auto-approve children.
- Variant Finals carry attribution metadata: `parent_project_id`, `variant_spec`, `extracted_brief_id` (for Learning / Performance later).
- Publish records remain per Final (ADR-0010).

### 6. Marketplace adapters

v1 ships **placeholders + feature flag** (`MARKETPLACE_ADAPTERS=false`). No paid billing. Real marketplace is Wave 2G.

### 7. Agent tools (catalogue additions)

| Tool | Role |
|---|---|
| `extract_brief` | Enqueue URL/PDF extract → `ExtractedBrief` |
| `apply_brief` | Brief → brand + first cut (minimal or director) |
| `plan_variants` | Matrix plan + cost estimate |
| `render_variants` | Materialize child projects (+ optional render jobs) |
| `promote_variant_field` | Copy selected child fields back to parent |

All go through Studio Tool wrap + tool trace. Manual wizard UI calls the same mutations/APIs.

## Consequences

- Wave 2B can land schema (#149) and extract (#150–#151) without waiting on Intent UI; first-cut quality improves when Director lands.
- Variant Grid is a **project picker / matrix**, not a second editor model.
- Pomelli-like URL onboarding becomes a Studio feature, not a hand-authored brand folder.
- Follow-up docs: [ad-generator-and-variants.md](../architecture/ad-generator-and-variants.md), [ad-generator-flow.md](../ux/ad-generator-flow.md), plan 09.

## Rejected

- Treating extract as unstructured chat memory only.
- Fan-out as N full blob copies of the parent media set.
- Auto-Approve of the whole matrix.
- Live Meta/TikTok ads API spend in this epic.
- Replacing Brand Studio — extract **seeds** brand; founder can still edit in Brand Studio (ADR-0025).
