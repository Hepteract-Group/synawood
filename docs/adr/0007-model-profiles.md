# Model Profiles for pick-and-choose generation

Creative Studio selects models through **Model Profiles** (reasoner / image / video / speech / transcribe / caption / **embed_visual**), resolved via the Vercel AI SDK (and AI Gateway where useful). Defaults are starters only; founders can switch profiles or override a single role per Generation Job.

**Amended by [ADR-0051](./0051-agent-watches-the-player.md):** Profiles are an **internal** registry. Customers do not pick founder-edit, spend, or “Live clips.” SaaS default generates; confirm when £>0. If a picker is shown, it lists model names.  
**Amended by [ADR-0052](./0052-visual-shot-embeddings.md):** New role `embed_visual` (multimodal shot keyframe + text query). Text embed stays pinned `openai/text-embedding-3-small`, not a profile role.  
**Amended by [ADR-0084](./0084-gateway-model-families.md):** Curated allowlist stays. Each new Gateway id needs a **family adapter**, live smoke, then picker — never dump `/v1/models` into Send.  
**Amended by [ADR-0085](./0085-catalog-freeze-and-remap.md):** Allowlisted ids are Live, Remapped, or Frozen. Frozen cannot spend. Grok image canonical id is `spacexai/grok-imagine-image`.

**Why:** One locked vendor fights the goal of mixing best-in-class text, image, and video models. A profile registry keeps compositions and tools stable while models churn.

**Rejected:** Hard-coding Kling (or any single video API) into Remotion. Separate ad-hoc scripts per provider. Loading every Gateway model into the agent without a profile (unbounded cost/confusion).
