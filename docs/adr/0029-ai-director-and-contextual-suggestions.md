# ADR-0029 — AI Director and contextual clip suggestions

**Status:** accepted  
**Date:** 2026-08-03  
**Wave:** Vision 2A · Plan index **08** · Epic [#135](https://github.com/Hepteract-Group/marketing-os/issues/135)  
**Relates to:** ADR-0001 (Studio Agent harness), ADR-0018 (Studio Agent trust model), ADR-0026 (Intent + scenes), ADR-0031 (skill packs)  
**Does not replace:** [ADR-0086](./0086-generation-plan-and-artefacts.md) Generation Plan (shot list + dialogue + £ **before** generate). DirectorPlan remains the edit-diff on an existing timeline.  
**Note:** Earlier Vision draft numbered this as ADR-0026; that number is now Intent/Scenes.

## Context

Vision calls for two operations that today's chat loop technically supports but does not surface well:

1. **Global "Director" ops** — "make this feel more premium" should change transitions, music, pacing, colour, captions, end card in one coordinated pass, and be reviewable before commit.
2. **Contextual clip ops** — clicking a clip should surface concrete suggestions (Shorten, Zoom in on face, Replace background, Generate supporting B-roll, Match brand colours), each one-tap-executable.

Freeform chat can *emit* these mutations, but the founder has no preview, no scope control, no easy way to reject one edit and keep the others, and no cost visibility before spend.

## Decision

1. **Introduce a preview-first `direct_project` tool.** Contract:

   ```ts
   direct_project(input: {
     style?: string          // "premium", "energetic", "cinematic", …
     intentOverrides?: Partial<Intent>
     scope?: 'global' | { sceneIds: string[] } | { clipIds: string[] }
     dryRun?: true           // default true; must be set false explicitly to apply
   }): DirectorPlan
   ```

   `DirectorPlan` carries proposed edits, rationale, cost estimate, and status. The tool **does not mutate** the project when `dryRun` is true (default). A follow-up `commit_director_plan(planId)` applies the plan atomically.

2. **Introduce `suggest_for_clip(clipId)` and `suggest_for_scene(sceneId)` tools.** They return executable `Suggestion[]` (tool name + args). UI "Apply" dispatches an existing Studio Tool.

3. **The Director is not a new runtime.** ADR-0001 / ADR-0031 stand: one `runTurn` loop, one reasoner, tools mutate a Project. `direct_project` is a *fat tool* with a specialized prompt. No LangGraph / CrewAI.

4. **Preview UI is mandatory for Director; suggestions are one-tap-apply** (with spend confirm when cost &gt; 0).

5. **Persistence.** Durable plans live in a `director_plans` table (#139) so preview survives reload (ADR-0018). Until that table ships, Zod `DirectorPlan` may optionally mirror on `project.directorPlan` for schema round-trips only — commit path still waits on #139.

6. **Suggestions are cached per project revision.** Cheap suggestions are heuristic and free. Expensive ones are gated by the cost ledger.

## Consequences

- Tools: `direct.ts`, `suggest.ts`, `commit-plan.ts` (#139–#140).
- Skill pack: `marketing-skills/director-vibes/` (#141).
- UI: Director Preview modal + contextual drawer (#144–#145).
- Zod: `DirectorPlan` + `Suggestion` stubs land with #136 so tools/UI share one contract.

## Rejected alternatives

- **Multi-agent Director as a separate LLM.** See ADR-0031.
- **Auto-apply Director plans.** Violates ADR-0018.
- **Suggestions recomputed by the reasoner every turn.** Wasteful.

## Open questions

- Iterative refinement inside the modal ("more subtle") — plan 08 slice for #144.
- Multi-clip marquee-select suggestions — deferred.
