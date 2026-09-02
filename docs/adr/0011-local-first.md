# Local-first before Vercel

Every dashboard/Studio change must run on localhost for founder review before production (or casual) Vercel deploys. Same adapters (Supabase, Azure Blob, AI SDK) via `.env.local`; mocks only when explicitly opted in.

**Why:** Founder must see and review behaviour locally; avoids “works on Vercel only” loops and accidental spend/config drift.

**Rejected:** Preview-deploy-as-primary QA. Different persistence stacks for local vs prod.
