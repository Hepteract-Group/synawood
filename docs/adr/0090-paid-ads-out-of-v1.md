# Paid ads stay out of v1

**Status:** proposed  
**Date:** 2026-08-26  
**Issue:** [#306](https://github.com/Hepteract-Group/marketing-os/issues/306) (ads-integration gate)  
**Related:** [ADR-0040](./0040-autonomous-marketing.md), [ADR-0063](./0063-postiz-in-scope.md), [ADR-0082](./0082-hosted-billing-wallet-entitlements.md)  
**Does not supersede:** ADR-0040. This records the paid-ads decision that ADR-0040 left open.

Autonomous marketing and Postiz already refuse ad-account spend. Founders still asked for an explicit paid-ads ADR before #306 could ship a gate instead of a hole. We are **not** connecting Meta / Google / TikTok Ads Manager, and we are **not** letting a campaign action buy reach.

## Decision

1. **No paid ad-account integrations in v1.** Organic Postiz (X, LinkedIn, TikTok organic) stays in scope. Ads, blog, and email stay out of Postiz ([ADR-0063](./0063-postiz-in-scope.md)).
2. **#306 is the reject gate**, not a buyer. Mapping a Synawood channel to an ads product, storing ad-account OAuth, or enqueueing media-buy spend must fail closed with a sentence the operator can read (Work board / Settings), not a silent no-op.
3. **Wallet (ADR-0082) is for generation**, not media buying. Confirm-spend never covers ad-account currency.
4. A future ads ADR may supersede this. Until then, Plan 21 ships without ad spend.

## Considered

- **Enable ads with the same confirm-spend modal.** Rejected: confirm-spend is for model APIs on our keys; ad accounts are a different processor, different policy, and a founder product call we are not taking in this wave.
- **Leave #306 blocked forever.** Rejected: the gate is the product. Operators will try to bind an ads integration; the UI must say no.

## Consequences

- Night-shift / agents implement the **reject** path only. Do not enable paid ads APIs or spend.
- Postiz `settings.__type` mapping continues to reject ads types ([#799](https://github.com/Hepteract-Group/marketing-os/issues/799)).
