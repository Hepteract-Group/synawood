# ADR-0031 — "Multi-agent editing" is skill packs, not a multi-agent runtime

**Status:** accepted  
**Date:** 2026-08-03  
**Wave:** Vision 2A · Plan index **08** · Epic [#135](https://github.com/Hepteract-Group/marketing-os/issues/135)  
**Relates to:** ADR-0001 (Studio Agent harness), ADR-0008 (Marketing skills), ADR-0029 (AI Director)  
**Reaffirms:** ADR-0001  
**Note:** Earlier Vision draft numbered this as ADR-0028; that number is now extract vision enrichment (Wave 2B).

## Context

`thought_dumps/vision.md` describes "Multi-Agent Editing" with Director / Editor / Colourist / Motion / Audio / Copywriter / Marketing specialists. Read literally, this suggests seven agents with independent runtimes. ADR-0001 explicitly rejected that.

The question is not "should specialization exist" — clearly yes. The question is *where the specialization lives*.

## Decision

Specialists are **skill packs** + **fat tools**, not runtime agents.

1. **One reasoner, one tool loop** (ADR-0001 stands). A single `runTurn` calls Studio Tools; some tools (`direct_project`, `plan_scenes`, `plan_variants`) may invoke the reasoner with a *specialized system prompt* built from a curated Marketing skill pack. The outer trace sees one tool call.

2. **Skill packs encode specialists** under `core/marketing-skills/` (e.g. `director-vibes/`, `editor-cuts/`, `copywriter-hooks/`). Each pack is markdown loaded into the specialized prompt when the fat tool runs.

3. **Founder-visible surface is stable.** The founder does not talk to seven agents. They see: Studio Agent chat, Intent panel, Scene strip, Director modal, contextual suggestion drawers.

4. **Escape hatch.** Concurrent long-running specialists (e.g. Wave 2F Learning Agent) become out-of-loop background workers, not in-loop multi-agent orchestrators. A new ADR is required before adopting any multi-agent framework.

## Consequences

- No LangChain / LangGraph / CrewAI / autogen for Studio.
- `#141` lands starter `director-vibes` + specialist packs.
- ADR-0001's rejection table stays authoritative.

## Rejected alternatives

- **Full multi-agent runtime.** Cost, latency, and debugging cost outweigh benefit for one operator editing one project.
- **Rename Studio Agent to "Orchestrator" and add sub-agents.** Cosmetic; still requires the runtime we don't want.
