# Marketing skills for agents

## Two skill systems (do not conflate)

| System | Who uses it | Where | Purpose |
|---|---|---|---|
| **Engineering skills** | Coding agents (Cursor, etc.) | `.agents/skills/` (Matt Pocock set) | Spec, TDD, review, domain modeling |
| **Marketing skills** | Studio Agent (+ coding agents when editing GTM) | `core/marketing-skills/` + optional `products/{name}/marketing-skills/` | Channel craft, hooks, offers, objection handling, Brief patterns |

Engineering skills should **not** be loaded wholesale into the Studio Agent runtime — they teach coding workflow, not ad cuts. Marketing skills **should** be available to the Studio Agent so tool calls and copy match GTM practice.

## Recommendation: yes, give Studio Agents marketing skills

Load them as **versioned markdown packages** (same SKILL.md spirit: name, description, when to use, procedures) into the Studio harness:

1. Resolve skill set for `productId` (core + product overlays).
2. Select relevant skills from Brief (channel, format, angle) — not all skills every turn.
3. Inject compact skill excerpts into system prompt / tool policy.
4. Optionally expose `list_marketing_skills` / `load_marketing_skill` Studio Tools for on-demand depth.

Coding agents in this repo already see Runbooks and `product-marketing.md`; adding `core/marketing-skills/` makes that knowledge **modular and reusable** across products.

## Suggested starter skills (core)

| Skill | Enhances |
|---|---|
| `hooks-first-3s` | `set_hook_title`, script drafting |
| `channel-linkedin` / `channel-x` / `channel-tiktok` | length, tone, CTA placement |
| `founder-story-batch` | aligns with weekly founder content Runbook |
| `objection-handling` | pulls from product marketing objections |
| `privacy-claim-safety` | the private example-sensitive claims — never invent proof |
| `infographic-clarity` | image gen prompts + Remotion type hierarchy |
| `ad-slide-*` (locked) | carousel quality: scenes not color fills; Brand Studio wins |
| `ad-video-*` (locked) | video ads: library-first, inspect loop, no vendor CLIs |
| `budget-aware-creative` | prefer Recipe A / stills when near cost caps |
| `director-vibes` | AI Director style packs (ADR-0031) — loaded by `specialistPack()` |
| `editor-cuts` | timeline pacing for Director + `suggest_for_*` |
| `talking-head-first-pass` | ordered talking-head polish (ADR-0073) — skip inapplicable steps |
| `copywriter-hooks` | hook / CTA patterns for copy tools |
| `ad-constitution` | Wave **2N** operating principles (pinned on make-ad) |
| `audience-awareness` | never “everyone”; Schwartz awareness stages |
| `single-minded-proposition` | one idea; feature → benefit ladder |
| `visual-proof` | demonstrate in picture; Catalog numbers only |
| `cognitive-economy` | one focus; VO/type/picture complement; mute-robust |
| `concept-diversity` | new argument, not a recolor |
| `marketing-critic` | persuasion rubric for `inspect_preview` only |

Product overlays (customer ICP language) belong on the Organization in the app, not a committed `products/demo/marketing-skills/` pack.

## What marketing skills are not

- Not a substitute for Brand kit or Path C chrome.
- Not automatic Approve.
- Not LangChain “skill agents” — just structured context + optional tools.
- Not the Matt Pocock engineering pack copied into production prompts.

## Layout

```
core/marketing-skills/
  README.md
  hooks-first-3s/SKILL.md
  channel-linkedin/SKILL.md
  ...
products/demo/   # fixture kit only — no customer ICP overlays in git
```

## Harness integration

```ts
const skills = await selectMarketingSkills({ productId, brief, userMessage })
const system = buildSystemPrompt({ brand, marketingDocExcerpt, skills, projectSummary })
```

Trace which skill ids were active on each turn (debugging + improve skills over time).

## Installable skills (ADR-0080)

Repo folders are the first-party baseline. Operators can also **install** markdown skills:

| Scope | Who it follows |
|---|---|
| Product (Organization) | Everyone on that Product |
| Account | That user, on every Product they can edit |

Settings → Packs / Skills: enable, disable, uninstall. Install from a signed pack **or** from [skills.sh](https://skills.sh) (`owner/repo` / `SKILL.md` URL). Hosted SaaS: instructions only — refuse `scripts/` and binaries.

`selectMarketingSkills` must include enabled installs (Product then Account). Settings is not a shelf. Details: [ADR-0080](../adr/0080-installable-studio-skills.md), [ADR-0039](../adr/0039-agent-marketplace.md).

