# Marketing skills package for Studio Agent

Studio Agent (and coding agents working on GTM) load **Marketing skills** from `core/marketing-skills/` (+ product overlays), separate from `.agents/skills/` engineering skills.

**Why:** Targeted channel/hook/offer craft improves tool use and copy without stuffing the entire repo into the prompt. Keeps engineering workflow skills out of the production Studio runtime.

**Rejected:** Feeding Matt Pocock engineering skills into Studio Agent prompts. Relying only on unstructured `product-marketing.md` with no modular skill selection.

**Amended 2026-08-24 ([ADR-0080](./0080-installable-studio-skills.md)):** Operators may also install markdown skills (Product-scoped or Account-scoped, including from skills.sh). Repo skills remain the first-party baseline. Installed packs must actually load on the live turn. Skills still do not register Studio Tools.
