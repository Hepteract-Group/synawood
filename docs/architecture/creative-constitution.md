# Creative constitution (Wave 2N)

Contract: [ADR-0092](../adr/0092-creative-constitution.md).  
Epic: [#1203](https://github.com/Hepteract-Group/marketing-os/issues/1203).  
**Source (keep for later agents):** [ChatGPT — Digital Marketing Agent Principles](https://chatgpt.com/share/6a909d42-dab4-83ed-8276-a393f782fae2).

Wave **2M** is how the agent *makes* motion. Wave **2N** is how it decides *what is worth making*.

## One agent

ChatGPT drew Strategist → Creative Director → Copy → Art → Renderer → Critic as boxes. In Synawood those boxes are **skill packs** plus **brief fields** plus **`inspect_preview`**. Not LangGraph. Not 13 chats. [ADR-0001](../adr/0001-studio-agent-harness.md), [ADR-0031](../adr/0031-multi-agent-as-skills.md).

```
Operator chat
    → Studio Agent (one reasoner, one tool loop)
         loads ad-constitution + selected craft packs
         writes timeline or composition source (2M)
    → inspect_preview (ADR-0051)
         loads editor-critic + marketing-critic
    → operator Approves
```

## Hierarchy

Communication → relevance → persuasion → clarity → brand → platform fit → aesthetics.

Aesthetics support the first six. They do not outrank them. Do not use this list to refuse kinetic type, Lottie, 3D, or authored Remotion ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)).

## ChatGPT engines → Synawood tickets

Do not recreate a row whose “already in Synawood” column is the whole job. Follow-up tickets exist only where advice is still missing.

| ChatGPT epic | Already in Synawood | 2N follow-up |
|---|---|---|
| 1. Marketing Objective Engine | Intent, campaign-brief-drafter | [#1205](https://github.com/Hepteract-Group/marketing-os/issues/1205) objective / KPI / desired behaviour |
| 2. Audience Intelligence | product-marketing.md ICP | [#1206](https://github.com/Hepteract-Group/marketing-os/issues/1206) awareness stage |
| 3. Proposition Engine | Catalog, `claim-vs-catalog` | [#1207](https://github.com/Hepteract-Group/marketing-os/issues/1207) one primary message |
| 4. Creative Strategy Engine | ADR-0027 hook × CTA variants | [#1208](https://github.com/Hepteract-Group/marketing-os/issues/1208) *concept* diversity |
| 5. Hook & Attention Engine | `hooks-first-3s`, `ad-video-first-3s` | [#1209](https://github.com/Hepteract-Group/marketing-os/issues/1209) visual/audio hooks, no logo-first |
| 6. Persuasion Engine | objection/proof slide skills | [#1210](https://github.com/Hepteract-Group/marketing-os/issues/1210) objections + claims registry |
| 7. Story/Sequence Planner | ADR-0026 scenes | [#1211](https://github.com/Hepteract-Group/marketing-os/issues/1211) PMO default, authored scene roles |
| 8. Art Direction Engine | **#1184 motion kit** | [#1212](https://github.com/Hepteract-Group/marketing-os/issues/1212) cognitive load only — not a second kit |
| 9. Audio Direction Engine | music, duck, SFX, karaoke | [#1213](https://github.com/Hepteract-Group/marketing-os/issues/1213) complementarity + mute-robust |
| 10. Platform Adaptation | aspect tiles, channel skills | [#1214](https://github.com/Hepteract-Group/marketing-os/issues/1214) native *grammar*, not letterbox |
| 11. Brand & Compliance | Brand kit, music license | [#1215](https://github.com/Hepteract-Group/marketing-os/issues/1215) provenance + a11y; localisation stays [#324](https://github.com/Hepteract-Group/marketing-os/issues/324) |
| 12. Experimentation & Learning | Wave **2F** [#237](https://github.com/Hepteract-Group/marketing-os/issues/237) / [#250](https://github.com/Hepteract-Group/marketing-os/issues/250) | [#1216](https://github.com/Hepteract-Group/marketing-os/issues/1216) hypothesis now; fatigue blocked by #237. No paid ads ([ADR-0090](../adr/0090-paid-ads-out-of-v1.md)) |
| 13. Creative Critic | **#549** `inspect_preview` | [#1217](https://github.com/Hepteract-Group/marketing-os/issues/1217) marketing rubric on the same pass |
| Skill packs | ADR-0008 / 0031 / 0080 | [#1218](https://github.com/Hepteract-Group/marketing-os/issues/1218) constitution packs; installs stay [#950](https://github.com/Hepteract-Group/marketing-os/issues/950) |

## Skills that must load

Chat (via `selectMarketingSkills`): `ad-constitution` pinned on make-ad / carousel / campaign. Gap packs: `audience-awareness`, `single-minded-proposition`, `visual-proof`, `cognitive-economy`, `concept-diversity`. Existing craft packs stay.

Critic only (not chat): `editor-critic`, `marketing-critic`.

Coding agents: `.agents/skills/studio-ad-constitution/`.

## Operator surfaces

Status that gates Approve lives on Intent / cut review / the persistent player banner — not a toast, not a console log, not a disabled control with no copy ([ux-first](../../.cursor/rules/ux-first.mdc)).

## Out of scope

- Unsandboxed eval, live multiplayer, CapCut project import (unchanged).
- Paid ad-account APIs.
- A second Studio Agent named “Critic.”
