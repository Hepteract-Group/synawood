# ADR-0040 — Autonomous marketing (goals → gated actions)

**Status:** accepted  
**Date:** 2026-08-16  
**Wave:** Vision 2G · Plan index **21** · Epic [#297](https://github.com/Hepteract-Group/marketing-os/issues/297)  
**Related:** ADR-0001 (harness), ADR-0018 (trust / confirm spend), ADR-0021 (campaign packs), ADR-0024 (roles), ADR-0039 (packs)  
**Does not authorize:** paid ad-account spend or silent money movement.

## Context

Founders want goal decomposition (“grow waitlist”, “ship 3 Finals this week”) into plans and actions without a black-box agent spending money. Epic [#297](https://github.com/Hepteract-Group/marketing-os/issues/297) children cite plan 21 + this ADR.

## Decision

### 1. Three-tier model

1. **Goal** — outcome + success metric + product scope  
2. **Plan** — ordered steps the strategist skill proposes  
3. **Action** — concrete work item (`create_campaign_pack`, `open_studio_project`, `draft_brief`, …) with status `proposed` → `awaiting_approval` → `approved` | `rejected` → `running` → `done` | `failed` | `killed`

### 2. Human gate before side effects

- Any action that enqueues spend, publish, or external post requires **role-gated approval** (owner/editor per ADR-0024).  
- `#306` ads integration stays blocked until a paid-ads ADR exists. **[ADR-0090](./0090-paid-ads-out-of-v1.md) (proposed)** is that ADR: v1 rejects ad-account spend; #306 ships the gate, not a buyer.

### 3. Executor is a dispatcher, not a second agent runtime

- `dispatchCampaignAction` maps action type → existing Studio Tools / HTTP / runbooks.  
- Still one Studio Agent loop when the founder chats; autonomous progress is a **board + worker**, not CrewAI.

### 4. Schema (names may refine in #298)

- `campaign_goals`, `campaign_plans`, `campaign_actions` (+ optional `campaign_action_events` audit)  
- Product-scoped; RLS + service_role  

### 5. Pause / kill

- Goal or plan can be `paused` / `killed`; in-flight actions cooperative-cancel where jobs support it (#305).

## Consequences

- Plan 21 slices [#298](https://github.com/Hepteract-Group/marketing-os/issues/298)–[#309](https://github.com/Hepteract-Group/marketing-os/issues/309) implement this contract.  
- No autonomous ad spend in v1.

## Rejected

- Fully autonomous media buying.  
- Multi-agent strategist swarm.  
- Storing goals only in chat transcripts without durable rows.
