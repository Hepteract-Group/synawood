# ADR-0092 — Creative constitution for Studio ads

**Status:** accepted  
**Date:** 2026-08-27  
**Wave:** Vision **2N** · Epic [#1203](https://github.com/Hepteract-Group/marketing-os/issues/1203) · Docs [#1204](https://github.com/Hepteract-Group/marketing-os/issues/1204)  
**Architecture:** [creative-constitution.md](../architecture/creative-constitution.md)  
**Source (keep):** [ChatGPT — Digital Marketing Agent Principles](https://chatgpt.com/share/6a909d42-dab4-83ed-8276-a393f782fae2)  
**Does not supersede:** [ADR-0001](./0001-studio-agent-harness.md), [ADR-0031](./0031-multi-agent-as-skills.md), [ADR-0051](./0051-agent-watches-the-player.md), [ADR-0091](./0091-empowered-agent-authored-compositions.md), [ADR-0090](./0090-paid-ads-out-of-v1.md)

## Context

Wave **2M** lets the Studio Agent author Remotion motion graphics. That is execution. Without a marketing constitution, the same harness produces logo intros, feature slideshows, and recolored “variants” that do not persuade.

A founder research chat listed 20 operating principles and 13 “engines” (objective, audience, proposition, strategy, hook, persuasion, sequence, art, audio, platform, brand/compliance, learning, critic). Read literally, that diagram is a 13-agent pipeline. ADR-0001 and ADR-0031 already rejected in-loop multi-agent runtimes. Specialists are skill packs.

## Decision

1. **Adopt the constitution**, not the swarm. ChatGPT’s engines are Synawood **epics + skill packs + brief fields + critic rubric**. One Studio Agent. One `inspect_preview` pass.

2. **Keep the source URL** in this ADR and in [creative-constitution.md](../architecture/creative-constitution.md) so later agents can re-read the arguments.

3. **Mental model for every make-ad turn:**  
   Objective → Audience → Context → Message → Creative mechanism → Execution → Action → Measurement → Learning

4. **Optimisation hierarchy:** communication → relevance → persuasion → clarity → brand → platform fit → aesthetics. Aesthetics support the first six. They do not outrank them. This does **not** roll back ADR-0091: still ship beautiful, varied motion. The critic scores communication first, then craft.

5. **Storytelling is a technique**, not a required arc. Default sequence is problem → mechanism → outcome. Time-to-value beats logo-then-world.

6. **Concept ≠ execution variation.** Recolor, recast, or new music is not a new ad. A new *argument* is.

7. **Never fabricate proof.** Strong claims come from Catalog / a claims registry. ASA/FTC: the consumer *impression* counts. “Available online” is not a commercial license.

8. **Learning without ads APIs.** Persist a hypothesis on each Final now. Fatigue detection waits on Wave **2F** [#237](https://github.com/Hepteract-Group/marketing-os/issues/237). Do not connect paid ads (ADR-0090).

9. **Existing waves stay owners** of their surfaces. 2N follows up; it does not recreate sandbox (#1183), motion kit (#1184), `inspect_preview` (#549), performance ingest (#237), or localisation (#324).

## Constitution (20)

1. Know exactly who you are speaking to.  
2. Know the behaviour the creative is meant to cause.  
3. One dominant idea per creative.  
4. Earn attention before persuasion.  
5. Communicate value as early as possible.  
6. Prefer customer outcomes over product features.  
7. Show whenever showing is stronger than telling.  
8. Every meaningful claim requires proof.  
9. Anticipate the viewer’s objections.  
10. Reduce cognitive effort.  
11. Use visuals, words, motion, and sound complementarily.  
12. Preserve meaning with sound off.  
13. Make the brand identifiable without logo spam.  
14. Design natively for the destination platform.  
15. End with a clear behavioural next step.  
16. Generate genuinely different creative hypotheses, not superficial variations.  
17. Treat every campaign as an experiment.  
18. Learn from performance and update future creative decisions.  
19. Never fabricate evidence, testimonials, or capabilities.  
20. Respect copyrights, accessibility, advertising law, and platform rules.

## Consequences

- First-party packs live under `core/marketing-skills/` (`ad-constitution` and gap packs). Critic packs load only in `inspect_preview`.
- Coding agents load `.agents/skills/studio-ad-constitution/` when editing Studio / critic / skills.
- Brief fields (objective, awareness, primary message, concept, hypothesis) land as child tasks of [#1203](https://github.com/Hepteract-Group/marketing-os/issues/1203).
- Durable IP is this decision layer. Generation models stay interchangeable execution.

## Rejected alternatives

- **Thirteen in-loop agents** (Strategist, CD, Copy, Art, …). Rejected by ADR-0001 / 0031. Cost, latency, and a second chat surface.
- **Vague “be engaging / tell stories / be relatable.”** Relatability is an outcome of audience fit. Story is optional.
- **Rolling back ADR-0091** because “performance creative can be ugly.” Ugly unreadable type still fails. Beautiful motion that says nothing also fails.
