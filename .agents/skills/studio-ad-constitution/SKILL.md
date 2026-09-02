---
name: studio-ad-constitution
description: Apply Synawood ad constitution when editing Studio Agent, critic, marketing skills, or authored motion. Use when changing make-ad behaviour, inspect_preview, skill packs, or composition source.
---

# Studio ad constitution

Read [ADR-0092](../../../docs/adr/0092-creative-constitution.md) and [creative-constitution.md](../../../docs/architecture/creative-constitution.md). Source chat (keep): https://chatgpt.com/share/6a909d42-dab4-83ed-8276-a393f782fae2

## Do

- Encode ChatGPT’s 13 engines as **skills, brief fields, and critic checks**. One Studio Agent.
- Pin `ad-constitution` on make-ad turns. Critic packs stay out of the chat prompt.
- Prefer showing over claiming in motion graphics. Catalog/Extracts for numbers.
- Default sequence: problem → mechanism → outcome. Story only if they asked.
- New variants = new **concepts**, not recolors.
- Persist a hypothesis even without ads data. Do not add paid-ads APIs.

## Rank

Communication → relevance → persuasion → clarity → brand → platform fit → aesthetics.

Do not use this rank to refuse Remotion craft ([ADR-0091](../../../docs/adr/0091-empowered-agent-authored-compositions.md)). Do not ship beautiful noise.

## Do not

- Add LangGraph / CrewAI / extra in-loop agents for Strategist/CD/Art
- Recreate #1183 sandbox, #1184 motion kit, #549 inspect_preview, #237 ingest, #324 localisation
- Let operators paste TSX as the product path
