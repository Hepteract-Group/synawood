# ADR-0034 — Creative Knowledge Graph (structure snapshot)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision 2F · Plan index **15** · Epic [#227](https://github.com/Hepteract-Group/marketing-os/issues/227)  
**Related:** ADR-0026 (Intent + Scenes), ADR-0010 (Approve / Finals)  
**Corrects:** Epic [#227](https://github.com/Hepteract-Group/marketing-os/issues/227) children cited this ADR before the file existed. **This ADR is the contract.**

## Context

Intent + Scenes already describe beats on the Studio Project. Learning / Performance later need a **stable structure snapshot** (hook → education → trust → offer → CTA) on projects and Finals — not a separate CMS.

## Decision

### 1. `project.creativeStructure` on Studio Project JSON

Optional object: `{ beats[], source, derivedAt? }`. Beat kinds: `hook` | `education` | `trust` | `offer` | `cta`. Empty default is valid.

### 2. Generated columns on `studio_projects`

Postgres stores `creative_structure` and `creative_structure_source` as **generated columns** from `project_json`, so SQL/analytics can filter without parsing JSON in every query. Tips stay canonical in `project_json`.

### 3. Derive from Scenes (#229)

`deriveCreativeStructure` maps Scene roles onto beats and times them from assigned clips (or `targetDurationFrames` / 90f when empty):

| Scene role | Beat kind |
|---|---|
| `hook` | hook |
| `problem`, `context` | education |
| `proof` | trust |
| `solution`, `offer` | offer |
| `cta` | cta |
| `custom` | skipped |

Source becomes `intent_scenes`. Manual `set_creative_structure` sets `source: manual`.

### 4. Approve snapshot (#231)

`final_assets.creative_structure` is a **copy** of the project JSON at Approve time. Existing Finals are immutable: a repeat Approve of the same render does not rewrite the snapshot.

### 5. Nudge, do not block (#233)

Empty beats show a visible banner on the sign-off modal. Approve still proceeds. Authored motion maps beats to Sequences (`beatsToSequences`, #1201) and stores `artDirection.beatLayout` for inspect. Empty structure is a one-scene fallback plus that Approve banner — not a second pill, not an inspect fail.

## Consequences

- Slices [#228](https://github.com/Hepteract-Group/marketing-os/issues/228)–[#236](https://github.com/Hepteract-Group/marketing-os/issues/236) implement this contract.
- Retroactive tagging lives on the work board (`/content`), not a silent SQL rewrite.

## Rejected

- A separate knowledge-graph product / Neo4j.
- Blocking Approve when structure is empty.
