# Local-first development

Dashboard and Creative Studio changes should run on **localhost** before anyone treats a hosted deploy as the review.

## Rule

1. Implement against `dashboard` (or the monorepo app).
2. Review in the browser on `localhost:3000`.
3. Only then: pull request → merge → your own host.

Do not treat “push to a cloud preview to see it” as the default loop.

## Local stack map

| Concern | Local |
|---|---|
| Next.js dashboard + Studio UI | Docker compose, or `npm run dev` for UI-only |
| Postgres | Local Supabase CLI **or** a free remote project with local env — both OK |
| Media | Dev container / prefix via env |
| Generators | Real keys in gitignored env **or** mock adapters for UI-only tests |
| Remotion preview | In-browser Player; encode via the worker when testing export |
| Extract / render worker | Docker compose with Chromium |
| Social scheduler | Optional local container; tests never call a live host |

## Env discipline

| File | Committed? | Used when |
|---|---|---|
| `.env`, `dashboard/.env.local` | no | local services |
| `.env.example` | yes | names only |

Never mix a local database URL into a production deploy config.

## Verification

- Feature works on localhost without a hosted dashboard
- Migrations applied to the database you actually use
- No secrets in git
- You can click through the path being shipped
