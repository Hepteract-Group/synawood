import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpenApiV1 } from '../lib/openapi-v1'
import { renderOpenApiV1Markdown } from '../lib/openapi-v1-markdown'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '../../docs/api/v1/README.md')
writeFileSync(out, renderOpenApiV1Markdown(buildOpenApiV1()))
