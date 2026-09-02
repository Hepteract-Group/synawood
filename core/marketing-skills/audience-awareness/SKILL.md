---
name: audience-awareness
description: Never write for everyone. Fit copy and pictures to awareness stage. Use when briefing, scripting, or reviewing an ad.
category: core
locked: true
---

# Audience awareness

Never write for `everyone`. Use Synawood Intent fields: `persona`, `awarenessStage`, `primaryPain` (plus `language` / `context` when known). Do not dump ICP markdown into the turn.

## Before write_composition (ask or infer, then `set_intent`)

1. Who — `intent.audience.persona` (a job + situation, not “SMBs”)
2. Already know — `intent.audience.awarenessStage`
3. Want — what a win looks like for them
4. Fear — `intent.audience.primaryPain`
5. Alternatives — what they use instead
6. Objections — what they will not believe
7. Why now — why this week, not later

If a field is missing, infer from the operator brief and say the assumption in chat. Then set it.

## Awareness stage (same product, different ad)

| `awarenessStage` | Job of the ad |
|---|---|
| unaware | Name a missed cost they do not yet treat as a problem |
| problem-aware | Show the messy current job (`primaryPain`) |
| solution-aware | Show the mechanism, not the brand yet |
| product-aware | Name the product and the specific job it does |
| most-aware | Offer / trial / next step (`intent.cta`) |

## Bad vs better

Bad: “Transform your business with AI.” (no persona, for everyone)  
Better: “Still downloading tender documents and checking them manually every morning?” (`persona`: UK bid writers, `awarenessStage`: problem-aware, `primaryPain`: uneditable scans)

Bad: “the private example is the all-in-one PDF platform.”  
Better: “Fourteen portals, one inbox — stop hunting tenders at 11pm.”

## Done when

The first line would make the intended person say “that’s me,” and would bounce a stranger who is not the buyer. inspect_preview fails empty/`everyone` audience.
