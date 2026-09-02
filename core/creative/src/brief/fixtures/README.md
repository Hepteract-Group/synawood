# Brief fixtures (#160)

Canonical `ExtractedBrief` JSON for unit/integration tests.

| File | Use |
|---|---|
| `demo-url-brief.json` | URL-sourced brief (hooks/CTAs/confidence) |
| `demo-pdf-brief.json` | PDF-sourced brief |

```ts
import { loadBriefFixture } from './load-fixture'
const brief = loadBriefFixture('demo-url-brief')
```

## Coverage commands

```bash
# PR gate — Ad Generator library (≥90% lines/statements/functions, ≥75% branches)
npm run test:ad-generator:coverage

# Daily full @synawood/creative report (HTML + LCOV artifact; no fail gate)
npm run test:coverage:daily -w @synawood/creative
```

CI: `mr-checks.yml` enforces the gate; `coverage-daily.yml` uploads the full report once a day (06:00 UTC).
